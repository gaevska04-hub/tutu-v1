#!/usr/bin/env python3
"""
Обновляет assets/prices.json минимальными ценами по популярным направлениям.

Источник задаётся секретом репозитория TUTU_PRICES_API_URL — шаблоном адреса
с подстановками {from_iata}, {to_iata}, {from_id}, {to_id}, например:
    https://api.example.tutu.ru/min-prices?from={from_iata}&to={to_iata}
Необязательный секрет TUTU_PRICES_API_TOKEN уходит в заголовок Authorization.

Если секрета нет — скрипт ничего не меняет и завершается успешно.
Если по маршруту не удалось получить цену — остаётся прежнее значение.

Ответ API разбирает parse_price(); подправьте её под реальный формат,
когда разработчики Туту скажут, что отдаёт их эндпоинт.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PRICES_FILE = Path(__file__).resolve().parent.parent / "assets" / "prices.json"

IATA = {
    "dushanbe": "DYU",
    "khujand": "LBD",
    "moscow": "MOW",
    "petersburg": "LED",
    "yekaterinburg": "SVX",
    "samara": "KUF",
}

# Промокод INTAVIATUTU: 15 % от стоимости, но не больше 1 000 ₽.
PROMO_RATE = 0.15
PROMO_MAX_RUB = 1000


def parse_price(payload):
    """Достаёт минимальную цену в рублях из ответа API. Вернуть None, если цены нет."""
    if isinstance(payload, (int, float)):
        return float(payload)
    if isinstance(payload, dict):
        for key in ("min_price", "minPrice", "price", "value"):
            if isinstance(payload.get(key), (int, float)):
                return float(payload[key])
        for key in ("prices", "items", "data", "results"):
            if key in payload:
                return parse_price(payload[key])
    if isinstance(payload, list):
        found = [p for p in (parse_price(x) for x in payload) if p]
        return min(found) if found else None
    return None


def fetch_price(url_template, token, from_id, to_id):
    url = url_template.format(
        from_iata=IATA[from_id], to_iata=IATA[to_id], from_id=from_id, to_id=to_id
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return parse_price(json.load(resp))


def main():
    url_template = os.environ.get("TUTU_PRICES_API_URL", "").strip()
    if not url_template:
        print("TUTU_PRICES_API_URL не задан — цены не обновляются.")
        return 0
    token = os.environ.get("TUTU_PRICES_API_TOKEN", "").strip()

    data = json.loads(PRICES_FILE.read_text(encoding="utf-8"))
    routes = data.get("routes", {})
    updated = 0

    for key, route in routes.items():
        from_id, to_id = key.split("-", 1)
        if from_id not in IATA or to_id not in IATA:
            print(f"{key}: нет кода IATA, пропускаю")
            continue
        try:
            base = fetch_price(url_template, token, from_id, to_id)
        except Exception as exc:  # сеть, формат, 4xx/5xx — оставляем старую цену
            print(f"{key}: ошибка запроса ({exc}), оставляю прежнюю цену")
            continue
        if not base or base <= 0:
            print(f"{key}: цены нет, оставляю прежнюю")
            continue

        base = round(base)
        if route.get("promo"):
            discount = min(round(base * PROMO_RATE), PROMO_MAX_RUB)
            new = {"price": base - discount, "old_price": base}
        else:
            new = {"price": base, "old_price": None}
        route.update(new, currency="RUB")
        updated += 1
        print(f"{key}: {route['price']} ₽")

    if not updated:
        print("Ни одной цены не получено — файл не меняю.")
        return 0

    data["updated"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    data["source"] = "api"
    PRICES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Обновлено маршрутов: {updated} из {len(routes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
