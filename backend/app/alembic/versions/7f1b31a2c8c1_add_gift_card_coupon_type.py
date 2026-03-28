"""add gift card coupon type

Revision ID: 7f1b31a2c8c1
Revises: 083a065d5e92
Create Date: 2026-03-28 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "7f1b31a2c8c1"
down_revision = "083a065d5e92"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing enum value used by CouponType.GIFT_CARD
    op.execute("ALTER TYPE coupontype ADD VALUE IF NOT EXISTS 'GIFT_CARD'")


def downgrade() -> None:
    # No-op: PostgreSQL does not support dropping enum values safely.
    pass
