/**
 * URL фото товара WB по nm_id через CDN-баскеты.
 * После vol ≤ 3485 (basket-20) WB добавляет по ~216 vol на каждый следующий басок —
 * формула покрывает текущий потолок ассортимента (nm ~9 млрд).
 */
export function wbPhotoUrl(nmId: number | null | undefined): string | null {
  if (!nmId || nmId <= 0) return null;
  const vol = Math.floor(nmId / 100_000);
  const part = Math.floor(nmId / 1_000);
  const basket = pickBasket(vol);
  return `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/tm/1.webp`;
}

function pickBasket(vol: number): string {
  let n: number;
  if (vol <= 143) n = 1;
  else if (vol <= 287) n = 2;
  else if (vol <= 431) n = 3;
  else if (vol <= 719) n = 4;
  else if (vol <= 1007) n = 5;
  else if (vol <= 1061) n = 6;
  else if (vol <= 1115) n = 7;
  else if (vol <= 1169) n = 8;
  else if (vol <= 1313) n = 9;
  else if (vol <= 1601) n = 10;
  else if (vol <= 1655) n = 11;
  else if (vol <= 1919) n = 12;
  else if (vol <= 2045) n = 13;
  else if (vol <= 2189) n = 14;
  else if (vol <= 2405) n = 15;
  else if (vol <= 2621) n = 16;
  else if (vol <= 2837) n = 17;
  else if (vol <= 3053) n = 18;
  else if (vol <= 3269) n = 19;
  else if (vol <= 3485) n = 20;
  else n = 20 + Math.ceil((vol - 3485) / 216);
  return String(n).padStart(2, '0');
}
