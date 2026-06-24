import pandas as pd

# 1. Завантажуємо CSV з data.gov.ua (реєстр ліцензій МОЗ)
# ⚠️ Тут треба вставити реальне посилання на CSV з порталу data.gov.ua
moz_url = "https://data.gov.ua/dataset/moz-licenses/resource/xxxxxxx/download/licenses.csv"
df_moz = pd.read_csv(moz_url, sep=";", encoding="utf-8")

# 2. Фільтруємо тільки юросіб (ті, що мають код ЄДРПОУ)
df_jur = df_moz[df_moz["ЄДРПОУ"].notna()].copy()

# 3. Завантажуємо CSV з ЄДР (юрособи)
# ⚠️ Тут також треба вставити реальне посилання на CSV з data.gov.ua для ЄДР
edr_url = "https://data.gov.ua/dataset/edr/resource/yyyyyyy/download/edr.csv"
df_edr = pd.read_csv(edr_url, sep=";", encoding="utf-8")

# 4. Зливаємо по коду ЄДРПОУ
df_merge = pd.merge(df_jur, df_edr[["ЄДРПОУ","Адреса"]], on="ЄДРПОУ", how="left")

# 5. Зберігаємо у Excel
df_merge.to_excel("licenses_jur_with_address.xlsx", index=False)
print("✅ Збережено у licenses_jur_with_address.xlsx")
