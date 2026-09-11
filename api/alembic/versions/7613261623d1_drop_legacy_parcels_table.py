"""drop legacy parcels table

Revision ID: 7613261623d1
Revises: e7f3b8c2a4d1
Create Date: 2026-09-11 11:43:43.501785

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7613261623d1'
down_revision: Union[str, Sequence[str], None] = 'e7f3b8c2a4d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("parcels")