from __future__ import annotations

from pydantic import BaseModel


class RolePublic(BaseModel):
    id: str
    slug: str
    name: str
    team: str
    abilities: dict

