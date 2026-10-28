"""add culinary dna and smart inventory

Revision ID: b21490234a91
Revises: e0824155331a
Create Date: 2026-10-27 20:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b21490234a91'
down_revision: Union[str, Sequence[str], None] = 'e0824155331a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to user_taste_profiles
    with op.batch_alter_table('user_taste_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('skill_level', sa.String(length=50), nullable=True, server_default='home_cook'))
        batch_op.add_column(sa.Column('diet_modes', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('active_mode', sa.String(length=50), nullable=True, server_default='comfort_food'))
        batch_op.add_column(sa.Column('weight_kg', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('height_cm', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('activity_level', sa.String(length=50), nullable=True, server_default='moderate'))
        batch_op.add_column(sa.Column('meals_per_day', sa.Integer(), nullable=True, server_default='3'))
        batch_op.add_column(sa.Column('allergies', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('ingredient_affinity', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('cuisine_affinity', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('flavor_params', sa.JSON(), nullable=True))

    # 2. Add columns to user_pantry_items
    with op.batch_alter_table('user_pantry_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('storage_zone', sa.String(length=50), nullable=True, server_default='fridge'))
        batch_op.add_column(sa.Column('is_staple', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('fuzzy_level', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('package_size', sa.Numeric(precision=10, scale=2), nullable=True))

    # 3. Create inventory_transactions table
    op.create_table(
        'inventory_transactions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('inventory_item_id', sa.String(length=36), nullable=True),
        sa.Column('cooking_session_id', sa.String(length=36), nullable=True),
        sa.Column('delta_quantity', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('fuzzy_before', sa.String(length=50), nullable=True),
        sa.Column('fuzzy_after', sa.String(length=50), nullable=True),
        sa.Column('reason', sa.String(length=50), server_default='cooked', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['user_pantry_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cooking_session_id'], ['cooking_sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_transactions_user_id'), 'inventory_transactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_inventory_transactions_inventory_item_id'), 'inventory_transactions', ['inventory_item_id'], unique=False)
    op.create_index(op.f('ix_inventory_transactions_cooking_session_id'), 'inventory_transactions', ['cooking_session_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_inventory_transactions_cooking_session_id'), table_name='inventory_transactions')
    op.drop_index(op.f('ix_inventory_transactions_inventory_item_id'), table_name='inventory_transactions')
    op.drop_index(op.f('ix_inventory_transactions_user_id'), table_name='inventory_transactions')
    op.drop_table('inventory_transactions')

    with op.batch_alter_table('user_pantry_items', schema=None) as batch_op:
        batch_op.drop_column('package_size')
        batch_op.drop_column('fuzzy_level')
        batch_op.drop_column('is_staple')
        batch_op.drop_column('storage_zone')

    with op.batch_alter_table('user_taste_profiles', schema=None) as batch_op:
        batch_op.drop_column('flavor_params')
        batch_op.drop_column('cuisine_affinity')
        batch_op.drop_column('ingredient_affinity')
        batch_op.drop_column('allergies')
        batch_op.drop_column('meals_per_day')
        batch_op.drop_column('activity_level')
        batch_op.drop_column('height_cm')
        batch_op.drop_column('weight_kg')
        batch_op.drop_column('active_mode')
        batch_op.drop_column('diet_modes')
        batch_op.drop_column('skill_level')
