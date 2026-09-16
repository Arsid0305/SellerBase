export type TariffMarketplace = 'WB' | 'OZON';

// Оставлены только вкладки с настоящими данными из WB.
// Комиссии, логистика, хранение, штрафы и габариты показывали вбитые
// вручную числа и удалены 16.09.2026 по решению владелицы.
export type TariffTabKey = 'wb-box' | 'wb-return' | 'wb-dynamics';
