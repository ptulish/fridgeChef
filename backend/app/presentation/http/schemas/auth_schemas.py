from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: Optional[str] = None
    created_at: Optional[datetime] = None


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Имя пользователя")
    email: str = Field(..., min_length=3, max_length=255, description="Email или логин")
    password: str = Field(..., min_length=4, max_length=128, description="Пароль")


class LoginRequest(BaseModel):
    email: str = Field(..., description="Email или логин")
    password: str = Field(..., description="Пароль")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
