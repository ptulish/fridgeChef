import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.presentation.http.dependencies import get_db_session, get_current_user
from app.infrastructure.db.models.user import UserModel, UserTasteProfileModel
from app.core.auth import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.presentation.http.schemas.auth_schemas import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
):
    name_clean = payload.name.strip()
    email_clean = payload.email.strip().lower()

    if not name_clean:
        raise HTTPException(status_code=400, detail="Имя не может быть пустым")
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email или логин не может быть пустым")

    # Check if email/login already taken
    stmt = select(UserModel).where(
        or_(
            func.lower(UserModel.email) == email_clean,
            func.lower(UserModel.name) == name_clean.lower(),
        )
    )
    res = await session.execute(stmt)
    existing = res.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email или именем уже зарегистрирован",
        )

    # Create user
    user_id = str(uuid.uuid4())
    user = UserModel(
        id=user_id,
        name=name_clean,
        email=email_clean,
        auth_subject=f"local_{user_id[:8]}",
        password_hash=hash_password(payload.password),
    )
    session.add(user)

    # Create associated default taste profile
    default_profile = UserTasteProfileModel(
        user_id=user_id,
        meat_preferences={"beef": True, "pork": True, "chicken": True, "fish": True},
        favorite_cuisines=["homestyle", "noodles"],
        sauce_preference={"sauce_volume": "standard"},
        salt_sensitivity="moderate",
        disliked_ingredients=[],
        equipment=["сковорода", "кастрюля", "духовка"],
        habits={"default_meat_portion_g": 200},
        ai_profile_summary=f"Личный кулинарный кабинет пользователя {name_clean}.",
    )
    session.add(default_profile)

    await session.commit()
    await session.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    return AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
):
    login_clean = payload.email.strip().lower()

    stmt = select(UserModel).where(
        or_(
            func.lower(UserModel.email) == login_clean,
            func.lower(UserModel.name) == login_clean,
        )
    )
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин (email) или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    return AuthResponse(access_token=token, user=user)


@router.post("/demo-login", response_model=AuthResponse)
async def demo_login(
    session: AsyncSession = Depends(get_db_session),
):
    """Quick one-click login for demonstration / testing (Chef)."""
    stmt = select(UserModel).where(UserModel.email == settings.DEFAULT_USER_EMAIL)
    res = await session.execute(stmt)
    user = res.scalars().first()

    if not user:
        # Fallback to first user
        stmt_first = select(UserModel).order_by(UserModel.created_at.asc())
        res_first = await session.execute(stmt_first)
        user = res_first.scalars().first()

    if not user:
        # Create Chef if no user exists
        user_id = str(uuid.uuid4())
        user = UserModel(
            id=user_id,
            email=settings.DEFAULT_USER_EMAIL,
            name="Chef",
            auth_subject="local_dev_chef",
            password_hash=hash_password("chef123"),
        )
        session.add(user)
        session.add(UserTasteProfileModel(user_id=user_id, ai_profile_summary="Кабинет Шеф-повара"))
        await session.commit()
        await session.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.name})
    return AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    _: UserModel = Depends(get_current_user),
):
    stmt = select(UserModel).order_by(UserModel.created_at.asc())
    res = await session.execute(stmt)
    return res.scalars().all()
