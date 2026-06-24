import pandas as pd
import re

df = pd.read_excel("partners.xlsx")
df.columns = df.columns.str.strip().str.lower()

def parse_address(addr):
    if pd.isna(addr) or addr.strip() == "#Н/Д":
        return None, None, None

    # область
    region_match = re.search(r"([А-ЯІЇЄҐ][^,]+ обл\.)", addr)
    region = region_match.group(1).replace(" обл.", " область") if region_match else None

    # населений пункт (місто, село, смт, селище)
    city_match = re.search(r"(місто|село|селище|смт\.?|м\.|с\.)\s+([^,]+)", addr, re.IGNORECASE)
    city = city_match.group(2).strip() if city_match else None

    # спеціальний випадок Києва
    if city and city.lower() == "київ":
        region = "Київська область"

    # все, що йде після назви населеного пункту → адреса
    if city_match:
        start = city_match.end()
        address = addr[start:].strip(" ,.")
    else:
        address = None

    return region, city, address

# оновлюємо ті самі колонки
for i, row in df.iterrows():
    region, city, address = parse_address(row["addressuk"])
    if region and row["region"] != "#Н/Д":
        df.at[i, "region"] = region
    if city and row["city"] != "#Н/Д":
        df.at[i, "city"] = city
    if address and row["address"] != "#Н/Д":
        df.at[i, "address"] = address

# зберігаємо результат
df.to_excel("partners_enriched.xlsx", index=False)
print("Готово! Дані з AddressUK розпарсені та записані у ті самі колонки.")
