"""rename issuer to brand

Revision ID: 8c9e339bf461
Revises: f570ae13b00a
Create Date: 2026-03-28 12:49:53.944540

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '8c9e339bf461'
down_revision = 'f570ae13b00a'
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table('issuer', 'brand')
    op.alter_column('coupon', 'issuer_id', new_column_name='brand_id')
    op.add_column('brand', sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True))

def downgrade():
    op.drop_column('brand', 'color')
    op.alter_column('coupon', 'brand_id', new_column_name='issuer_id')
    op.rename_table('brand', 'issuer')
