from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

import httpx


CATASTRO_PROPERTIES_URL = (
    "https://ovc.catastro.meh.es/"
    "OVCServWeb/OVCWcfCallejero/"
    "COVCCallejero.svc/rest/Consulta_DNPRC"
)


def _text(
        element: ET.Element,
        path: str,
) -> str | None:
    """
    Find text using Catastro element names while ignoring XML namespaces.
    """

    current = element

    for part in path.split("/"):
        found = None

        for child in current:
            tag = child.tag.split("}")[-1]

            if tag == part:
                found = child
                break

        if found is None:
            return None

        current = found

    if current.text is None:
        return None

    value = current.text.strip()

    return value or None


def _float_or_none(value: str | None) -> float | None:
    if value is None:
        return None

    cleaned = value.strip().replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return None


def _build_cadastral_ref(
        building: ET.Element,
) -> str | None:
    """
    Build the full cadastral reference from the official response.

    Typical structure:

    bi
      idbi
        rc
          pc1
          pc2
          car
          cc1
          cc2
    """

    pc1 = _text(building, "idbi/rc/pc1")
    pc2 = _text(building, "idbi/rc/pc2")
    car = _text(building, "idbi/rc/car")
    cc1 = _text(building, "idbi/rc/cc1")
    cc2 = _text(building, "idbi/rc/cc2")

    parts = [
        pc1,
        pc2,
        car,
        cc1,
        cc2,
    ]

    if not pc1 or not pc2:
        return None

    cadastral_ref = "".join(
        part or ""
        for part in parts
    ).replace(" ", "").upper()

    if len(cadastral_ref) < 14:
        return None

    return cadastral_ref


def _find_elements_by_local_name(
        root: ET.Element,
        name: str,
) -> list[ET.Element]:
    return [
        element
        for element in root.iter()
        if element.tag.split("}")[-1] == name
    ]


def _parse_unit(
        building: ET.Element,
        parcel_ref: str,
) -> dict[str, Any] | None:
    cadastral_ref = _build_cadastral_ref(building)

    if not cadastral_ref:
        return None

    # Catastro supplies a ready-made textual address in <ldt>.
    address = _text(
        building,
        "bi/dt/ldt",
    )

    # Depending on the XML variant <bi> may already be the current node,
    # therefore try the normal path as well.
    if address is None:
        address = _text(
            building,
            "dt/ldt",
        )

    floor = _text(
        building,
        "dt/locs/lous/lourb/loint/pt",
    )

    door = _text(
        building,
        "dt/locs/lous/lourb/loint/pu",
    )

    use = _text(
        building,
        "debi/luso",
    )

    built_area = _float_or_none(
        _text(
            building,
            "debi/sfc",
        )
    )

    return {
        "cadastral_ref": cadastral_ref,
        "parcel_ref": parcel_ref,
        "use": use,
        "address": address,
        "floor": floor,
        "door": door,
        "built_area_m2": built_area,
    }


async def fetch_cadastral_units(
        parcel_ref: str,
) -> list[dict[str, Any]]:
    """
    Fetch all cadastral properties associated with a 14-character parcel RC.

    Consulta_DNPRC officially supports a 14-character reference and returns
    every property whose cadastral reference begins with those 14 characters.
    """

    rc14 = "".join(
        parcel_ref.split()
    ).upper()[:14]

    if len(rc14) != 14:
        raise ValueError(
            "La referencia de parcela debe tener exactamente 14 caracteres"
        )

    timeout = httpx.Timeout(
        30.0,
        connect=10.0,
    )

    headers = {
        "User-Agent": "Catastro-Digital/1.0",
        "Accept": "application/xml,text/xml,*/*;q=0.8",
    }

    async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
            follow_redirects=True,
    ) as client:
        response = await client.get(
            CATASTRO_PROPERTIES_URL,
            params={
                "RefCat": rc14,
            },
        )

    response.raise_for_status()

    xml_text = response.text

    if not xml_text.strip():
        raise RuntimeError(
            "Catastro devolvió una respuesta vacía"
        )

    try:
        root = ET.fromstring(xml_text)

    except ET.ParseError as exc:
        preview = " ".join(
            xml_text[:300].split()
        )

        raise RuntimeError(
            "Catastro no devolvió XML válido. "
            f"Respuesta: {preview}"
        ) from exc

    # Catastro can return <lerr> in an otherwise valid XML response.
    errors = _find_elements_by_local_name(
        root,
        "lerr",
    )

    if errors:
        messages = [
            error.text.strip()
            for error in errors
            if error.text and error.text.strip()
        ]

        if messages:
            raise RuntimeError(
                "Catastro: " + "; ".join(messages)
            )

    buildings = _find_elements_by_local_name(
        root,
        "bi",
    )

    units: list[dict[str, Any]] = []
    seen: set[str] = set()

    for building in buildings:
        unit = _parse_unit(
            building,
            rc14,
        )

        if unit is None:
            continue

        cadastral_ref = unit["cadastral_ref"]

        # Defensive check. Consulta_DNPRC with RC14 should only return
        # properties belonging to that parcel.
        if not cadastral_ref.startswith(rc14):
            continue

        if cadastral_ref in seen:
            continue

        seen.add(cadastral_ref)
        units.append(unit)

    units.sort(
        key=lambda unit: unit["cadastral_ref"]
    )

    return units