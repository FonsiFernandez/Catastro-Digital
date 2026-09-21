from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth.dependencies import get_current_user
from app.db import engine
from app.models import User

router = APIRouter(prefix="/parcels", tags=["parcel-units"])

RC_RE = re.compile(r"^[0-9A-Z]{14,20}$")


class CadastralUnitPayload(BaseModel):
    cadastral_ref: str = Field(min_length=14, max_length=20)
    parcel_ref: str = Field(min_length=14, max_length=14)
    use: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=500)
    floor: str | None = Field(default=None, max_length=20)
    door: str | None = Field(default=None, max_length=20)
    built_area_m2: float | None = None


class UnitSelectionRequest(BaseModel):
    # An empty list is deliberately valid:
    # it means "keep the parcel, but remove all selected units".
    units: list[CadastralUnitPayload] = Field(default_factory=list)


def _normalise_rc(value: str) -> str:
    rc = "".join(value.split()).upper()

    if not RC_RE.fullmatch(rc):
        raise HTTPException(
            status_code=400,
            detail=(
                "La referencia catastral debe contener entre "
                "14 y 20 caracteres alfanuméricos"
            ),
        )

    return rc


def _unit_to_dict(
    unit: CadastralUnitPayload,
    rc14: str,
) -> dict[str, Any]:
    cadastral_ref = _normalise_rc(
        unit.cadastral_ref
    )

    parcel_ref = _normalise_rc(
        unit.parcel_ref
    )[:14]

    if (
        cadastral_ref[:14] != rc14
        or parcel_ref != rc14
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Todas las unidades seleccionadas deben "
                "pertenecer a la parcela indicada"
            ),
        )

    return {
        "cadastral_ref": cadastral_ref,
        "parcel_ref": rc14,
        "use": unit.use,
        "address": unit.address,
        "floor": unit.floor,
        "door": unit.door,
        "built_area_m2": unit.built_area_m2,
    }


@router.get("/{rc}/units/selection")
def get_unit_selection(
    rc: str,
    current_user: User = Depends(
        get_current_user
    ),
) -> dict[str, Any]:
    rc14 = _normalise_rc(rc)[:14]

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    cu.cadastral_ref,
                    cu.parcel_ref,
                    cu.use,
                    cu.address,
                    cu.floor,
                    cu.door,
                    cu.built_area_m2
                FROM user_cadastral_units ucu
                INNER JOIN cadastral_units cu
                    ON cu.cadastral_ref =
                       ucu.cadastral_ref
                WHERE ucu.user_id =
                      CAST(:user_id AS uuid)
                  AND cu.parcel_ref =
                      :parcel_ref
                ORDER BY
                    cu.cadastral_ref ASC
                """
            ),
            {
                "user_id":
                    str(current_user.id),
                "parcel_ref":
                    rc14,
            },
        ).mappings().all()

    units = [
        {
            "cadastral_ref":
                row["cadastral_ref"],
            "parcel_ref":
                row["parcel_ref"],
            "use":
                row["use"],
            "address":
                row["address"],
            "floor":
                row["floor"],
            "door":
                row["door"],
            "built_area_m2":
                (
                    None
                    if row["built_area_m2"]
                    is None
                    else float(
                        row["built_area_m2"]
                    )
                ),
        }
        for row in rows
    ]

    return {
        "parcel_ref": rc14,
        "count": len(units),
        "units": units,
    }


@router.put("/{rc}/units/selection")
def replace_unit_selection(
    rc: str,
    payload: UnitSelectionRequest,
    current_user: User = Depends(
        get_current_user
    ),
) -> dict[str, Any]:
    rc14 = _normalise_rc(rc)[:14]

    units: list[
        dict[str, Any]
    ] = []

    seen: set[str] = set()

    for item in payload.units:
        unit = _unit_to_dict(
            item,
            rc14,
        )

        if (
            unit["cadastral_ref"]
            in seen
        ):
            continue

        seen.add(
            unit["cadastral_ref"]
        )

        units.append(unit)

    with engine.begin() as conn:
        # Keep the shared unit catalogue up to date for every
        # unit still selected by this user.
        for unit in units:
            conn.execute(
                text(
                    """
                    INSERT INTO cadastral_units (
                        cadastral_ref,
                        parcel_ref,
                        use,
                        address,
                        floor,
                        door,
                        built_area_m2,
                        last_fetched_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :cadastral_ref,
                        :parcel_ref,
                        :use,
                        :address,
                        :floor,
                        :door,
                        :built_area_m2,
                        NOW(),
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (
                        cadastral_ref
                    )
                    DO UPDATE SET
                        parcel_ref =
                            EXCLUDED.parcel_ref,
                        use =
                            EXCLUDED.use,
                        address =
                            EXCLUDED.address,
                        floor =
                            EXCLUDED.floor,
                        door =
                            EXCLUDED.door,
                        built_area_m2 =
                            EXCLUDED.built_area_m2,
                        last_fetched_at =
                            NOW(),
                        updated_at =
                            NOW()
                    """
                ),
                unit,
            )

        # Replace the selection atomically.
        # This DELETE is also what makes an empty list meaningful.
        conn.execute(
            text(
                """
                DELETE FROM user_cadastral_units
                WHERE user_id =
                      CAST(:user_id AS uuid)
                  AND cadastral_ref IN (
                      SELECT
                          cadastral_ref
                      FROM cadastral_units
                      WHERE parcel_ref =
                            :parcel_ref
                  )
                """
            ),
            {
                "user_id":
                    str(current_user.id),
                "parcel_ref":
                    rc14,
            },
        )

        for unit in units:
            conn.execute(
                text(
                    """
                    INSERT INTO user_cadastral_units (
                        id,
                        user_id,
                        cadastral_ref,
                        created_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        CAST(:user_id AS uuid),
                        :cadastral_ref,
                        NOW()
                    )
                    ON CONFLICT (
                        user_id,
                        cadastral_ref
                    )
                    DO NOTHING
                    """
                ),
                {
                    "user_id":
                        str(current_user.id),
                    "cadastral_ref":
                        unit[
                            "cadastral_ref"
                        ],
                },
            )

    return {
        "ok": True,
        "parcel_ref": rc14,
        "saved_count": len(units),
        "units": units,
    }
