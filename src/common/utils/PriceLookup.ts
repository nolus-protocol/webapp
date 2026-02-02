/**
 * PriceLookup - Price lookup and formatting utilities
 *
 * Provides methods to look up and calculate prices from the prices store.
 */

import { Dec } from "@keplr-wallet/unit";
import { usePricesStore } from "@/common/stores/prices";
import { getCurrencyByDenom } from "./CurrencyLookup";
import { getDecimals } from "./NumberFormatUtils";
import { MAX_DECIMALS, ZERO_DECIMALS } from "@/config/global";

/**
 * Get price value for a denom in USD
 * Returns the total USD value of the amount
 */
export function getPriceByDenom(amount: number | string, denom: string): Dec {
  const pricesStore = usePricesStore();
  const currencyInfo = getCurrencyByDenom(denom);

  // Use currency.key (TICKER@PROTOCOL format) to lookup price
  const priceStr = pricesStore.prices[currencyInfo.key]?.price;

  if (!priceStr) {
    return new Dec(0);
  }

  const price = new Dec(priceStr);
  const assetAmount = new Dec(amount, currencyInfo.decimal_digits);

  return assetAmount.mul(price);
}

/**
 * Get the raw price for a currency key
 * Returns the price per unit, not the total value
 */
export function getPriceByKey(key: string): Dec {
  const pricesStore = usePricesStore();
  const priceStr = pricesStore.prices[key]?.price;

  if (!priceStr) {
    return new Dec(0);
  }

  return new Dec(priceStr);
}

/**
 * Calculate appropriate decimals for displaying an amount
 * based on its USD value
 */
export function formatDecimals(denom: string, amount: string): number {
  const usdValue = getPriceByDenom(amount, denom);
  const currencyInfo = getCurrencyByDenom(denom);
  const parsedAmount = Number(amount);

  // Zero amount
  if (usdValue.isZero() && parsedAmount === 0) {
    return ZERO_DECIMALS;
  }

  // Get decimals based on USD value
  const decimals = getDecimals(usdValue);

  if (decimals < 0) {
    // No threshold matched, use currency's native decimals
    if (currencyInfo.decimal_digits > MAX_DECIMALS) {
      return MAX_DECIMALS;
    }
    return currencyInfo.decimal_digits;
  }

  return decimals;
}

/**
 * Convert an amount to USD value as a formatted string
 */
export function getUsdValue(amount: number | string, denom: string): string {
  const usdValue = getPriceByDenom(amount, denom);
  return usdValue.toString();
}

/**
 * Check if a price exists for a currency key
 */
export function hasPrice(key: string): boolean {
  const pricesStore = usePricesStore();
  return key in pricesStore.prices;
}

/**
 * Get all prices as a record
 */
export function getAllPrices(): Record<string, { price: string; symbol: string }> {
  const pricesStore = usePricesStore();
  return pricesStore.prices;
}


