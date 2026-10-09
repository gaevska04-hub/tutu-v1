#!/usr/bin/env python3
"""
Обновляет assets/prices.json минимальными ценами с tutu.ru.

Для каждого направления открывается его страница на avia.tutu.ru
(например https://avia.tutu.ru/f/Dushanbe/Moskva/) и берётся минимальная
цена из разметки schema.org (AggregateOffer → lowPrice, в рублях).
Если разметки нет — цена из заголовка страницы («… от 17482 рублей …»).

Ничего не ломает:
- если страница не открылась или цена выглядит странно — по этому
  направлению остаётся прежнее значение;
- если не получилось ни одной цены — файл не меняется.

Для направлений с "promo": true применяется промокод INTAVIATUTU
(15 %, но не больше 1 000 ₽): на карточке будет цена с промокодом,
а цена tutu.ru — зачёркнутой.
"""
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PRICES_FILE = Path(__file__).resolve().parent.parent / "assets" / "prices.json"

# Как города называются в адресах avia.tutu.ru/f/<откуда>/<куда>/
SLUGS = {
    "dushanbe": "Dushanbe",
    "khujand": "Hudjand",
    "moscow": "Moskva",
    "petersburg": "Sankt-peterburg",
    "yekaterinburg": "Ekaterinburg",
    "samara": "Samara",
}

PROMO_RATE = 0.15
PROMO_MAX_RUB = 1000
MIN_RUB, MAX_RUB = 3000, 300000  # всё, что вне диапазона, считаем ошибкой разбора
PAUSE_SECONDS = 3                 # пауза между запросами, чтобы не нагружать сайт

USER_AGENT = (
    "Mozilla/5.0 (compatible; tutu-tj-landing-prices/1.0; "
    "+https://gaevska04-hub.github.io/tutu-v1/)"
)


def route_url(from_id, to_id):
    return f"https://avia.tutu.ru/f/{SLUGS[from_id]}/{SLUGS[to_id]}/"


def fetch_html(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept-Language": "ru-RU,ru;q=0.9"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def find_low_price(node):
    if isinstance(node, dict):
        if node.get("@type") == "AggregateOffer" and "lowPrice" in node:
            if str(node.get("priceCurrency", "RUB")).upper() == "RUB":
                try:
                    return float(node["lowPrice"])
                except (TypeError, ValueError):
                    return None
        for value in node.values():
            found = find_low_price(value)
            if found:
                return found
    elif isinstance(node, list):
        for value in node:
            found = find_low_price(value)
            if found:
                return found
    return None


def parse_price(html):
    for block in re.findall(
        r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S
    ):
        try:
            price = find_low_price(json.loads(block))
        except ValueError:
            continue
        if price:
            return price
    m = re.search(r"<title>[^<]*?от\s*([\d\s   ]+)\s*руб", html)
    if m:
        return float(re.sub(r"\D", "", m.group(1)))
    return None


def main():
    data = json.loads(PRICES_FILE.read_text(encoding="utf-8"))
    routes = data.get("routes", {})
    updated = 0

    for i, (key, route) in enumerate(routes.items()):
        from_id, to_id = key.split("-", 1)
        if from_id not in SLUGS or to_id not in SLUGS:
            print(f"{key}: не знаю адрес на tutu.ru, пропускаю")
            continue
        if i:
            time.sleep(PAUSE_SECONDS)
        url = route_url(from_id, to_id)
        try:
            base = parse_price(fetch_html(url))
        except Exception as exc:  # сеть, 404, блокировка — оставляем старую цену
            print(f"{key}: {url} не открылась ({exc}), оставляю прежнюю цену")
            continue
        if not base or not (MIN_RUB <= base <= MAX_RUB):
            print(f"{key}: цена не найдена или подозрительная ({base}), оставляю прежнюю")
            continue

        base = round(base)
        if route.get("promo"):
            discount = min(round(base * PROMO_RATE), PROMO_MAX_RUB)
            route.update(price=base - discount, old_price=base)
        else:
            route.update(price=base, old_price=None)
        route["currency"] = "RUB"
        updated += 1
        print(f"{key}: {base} ₽ на tutu.ru → на карточке {route['price']} ₽")

    if not updated:
        print("Ни одной цены не получено — файл не меняю.")
        return 0

    data["updated"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    data["source"] = "avia.tutu.ru"
    PRICES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Обновлено направлений: {updated} из {len(routes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
