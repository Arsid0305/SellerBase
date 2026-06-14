/**
 * URL фото товара WB по nm_id. На сервере хранится `sku_catalog.photo_url`,
 * но он у нас не заполнен — fallback на детерминированный basket-URL.
 * Таблица басков обновляется WB, при расширении ассортимента — расширить ниже.
 */
export function wbPhotoUrl(nmId: number | null | undefined): string | null {
  if (!nmId || nmId <= 0) return null;
  const vol = Math.floor(nmId / 100_000);
  const part = Math.floor(nmId / 1_000);
  let basket: string;
  if (vol <= 143) basket = '01';
  else if (vol <= 287) basket = '02';
  else if (vol <= 431) basket = '03';
  else if (vol <= 719) basket = '04';
  else if (vol <= 1007) basket = '05';
  else if (vol <= 1061) basket = '06';
  else if (vol <= 1115) basket = '07';
  else if (vol <= 1169) basket = '08';
  else if (vol <= 1313) basket = '09';
  else if (vol <= 1601) basket = '10';
  else if (vol <= 1655) basket = '11';
  else if (vol <= 1919) basket = '12';
  else if (vol <= 2045) basket = '13';
  else if (vol <= 2189) basket = '14';
  else if (vol <= 2405) basket = '15';
  else if (vol <= 2621) basket = '16';
  else if (vol <= 2837) basket = '17';
  else if (vol <= 3053) basket = '18';
  else if (vol <= 3269) basket = '19';
  else if (vol <= 3485) basket = '20';
  else basket = '21';
  return `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/1.webp`;
}
