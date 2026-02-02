/**
 * useValidation - Composable for form validation
 *
 * Provides common validation functions for forms across the application.
 * Centralizes validation logic to ensure consistency.
 *
 * @example
 * ```ts
 * const { validateAmount, validateAddress, errors, clearErrors } = useValidation();
 *
 * const isValid = validateAmount(amount, balance, decimals);
 * if (!isValid) {
 *   console.log(errors.amount); // Error message
 * }
 * ```
 */

import { ref, computed, type Ref } from "vue";
import { Decimal } from "@cosmjs/math";
import { useI18n } from "vue-i18n";

export interface ValidationErrors {
  amount: string | null;
  address: string | null;
  custom: Record<string, string | null>;
}

export interface AmountValidationOptions {
  /** The amount to validate (user input) */
  amount: string;
  /** The available balance in atomic units */
  balance: string;
  /** Number of decimal places for the asset */
  decimals: number;
  /** Minimum amount allowed (optional, defaults to 0) */
  minAmount?: string;
  /** Maximum amount allowed (optional, defaults to balance) */
  maxAmount?: string;
  /** Custom error messages */
  messages?: {
    empty?: string;
    invalid?: string;
    tooLow?: string;
    tooHigh?: string;
    insufficientBalance?: string;
  };
}

export interface AddressValidationOptions {
  /** The address to validate */
  address: string;
  /** Expected address prefix (e.g., 'nolus', 'osmo') */
  prefix?: string;
  /** Expected address length */
  expectedLength?: number;
  /** Custom regex pattern for validation */
  pattern?: RegExp;
  /** Custom error messages */
  messages?: {
    empty?: string;
    invalid?: string;
    wrongPrefix?: string;
  };
}

export function useValidation() {
  const { t } = useI18n();

  // Error state
  const errors = ref<ValidationErrors>({
    amount: null,
    address: null,
    custom: {},
  });

  // Computed helpers
  const hasErrors = computed(() => {
    return (
      errors.value.amount !== null ||
      errors.value.address !== null ||
      Object.values(errors.value.custom).some((e) => e !== null)
    );
  });

  const isAmountValid = computed(() => errors.value.amount === null);
  const isAddressValid = computed(() => errors.value.address === null);

  /**
   * Clear all errors
   */
  function clearErrors(): void {
    errors.value = {
      amount: null,
      address: null,
      custom: {},
    };
  }

  /**
   * Clear a specific error
   */
  function clearError(field: "amount" | "address" | string): void {
    if (field === "amount" || field === "address") {
      errors.value[field] = null;
    } else {
      errors.value.custom[field] = null;
    }
  }

  /**
   * Set a custom error
   */
  function setError(field: string, message: string): void {
    if (field === "amount" || field === "address") {
      errors.value[field] = message;
    } else {
      errors.value.custom[field] = message;
    }
  }

  /**
   * Validate an amount against balance and constraints
   */
  function validateAmount(options: AmountValidationOptions): boolean {
    const {
      amount,
      balance,
      decimals,
      minAmount = "0",
      maxAmount,
      messages = {},
    } = options;

    errors.value.amount = null;

    // Check for empty or invalid input
    if (!amount || amount.trim() === "") {
      errors.value.amount = messages.empty || t("message.invalid-amount");
      return false;
    }

    // Check for invalid format (starting with .)
    if (amount.startsWith(".")) {
      errors.value.amount = messages.invalid || t("message.invalid-amount");
      return false;
    }

    try {
      const inputAmount = Decimal.fromUserInput(amount, decimals);
      const walletBalance = Decimal.fromAtomics(balance, decimals);
      const min = Decimal.fromUserInput(minAmount, decimals);
      const max = maxAmount
        ? Decimal.fromUserInput(maxAmount, decimals)
        : walletBalance;

      // Check if amount is too low
      if (inputAmount.isLessThanOrEqual(min)) {
        errors.value.amount =
          messages.tooLow || t("message.invalid-balance-low");
        return false;
      }

      // Check if amount exceeds maximum
      if (inputAmount.isGreaterThan(max)) {
        errors.value.amount =
          messages.tooHigh || t("message.invalid-balance-big");
        return false;
      }

      // Check if amount exceeds wallet balance
      if (inputAmount.isGreaterThan(walletBalance)) {
        errors.value.amount =
          messages.insufficientBalance || t("message.invalid-balance-big");
        return false;
      }

      return true;
    } catch (e) {
      errors.value.amount = messages.invalid || t("message.invalid-amount");
      return false;
    }
  }

  /**
   * Validate a blockchain address
   */
  function validateAddress(options: AddressValidationOptions): boolean {
    const { address, prefix, expectedLength, pattern, messages = {} } = options;

    errors.value.address = null;

    // Check for empty address
    if (!address || address.trim() === "") {
      errors.value.address = messages.empty || t("message.invalid-address");
      return false;
    }

    // Check prefix if provided
    if (prefix && !address.startsWith(prefix)) {
      errors.value.address =
        messages.wrongPrefix || t("message.invalid-address");
      return false;
    }

    // Check length if provided
    if (expectedLength && address.length !== expectedLength) {
      errors.value.address = messages.invalid || t("message.invalid-address");
      return false;
    }

    // Check against pattern if provided
    if (pattern && !pattern.test(address)) {
      errors.value.address = messages.invalid || t("message.invalid-address");
      return false;
    }

    // Basic bech32 format check for cosmos addresses
    if (!prefix && !pattern) {
      // Default: check for valid bech32-like format
      const bech32Pattern = /^[a-z]+1[a-z0-9]{38,}$/;
      if (!bech32Pattern.test(address)) {
        errors.value.address = messages.invalid || t("message.invalid-address");
        return false;
      }
    }

    return true;
  }

  /**
   * Validate a percentage value (0-100)
   */
  function validatePercentage(
    value: string | number,
    options: {
      min?: number;
      max?: number;
      field?: string;
      messages?: { tooLow?: string; tooHigh?: string; invalid?: string };
    } = {}
  ): boolean {
    const { min = 0, max = 100, field = "percentage", messages = {} } = options;
    const fieldKey = field === "amount" || field === "address" ? field : field;

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      setError(fieldKey, messages.invalid || t("message.invalid-amount"));
      return false;
    }

    if (numValue < min) {
      setError(fieldKey, messages.tooLow || t("message.invalid-balance-low"));
      return false;
    }

    if (numValue > max) {
      setError(fieldKey, messages.tooHigh || t("message.invalid-balance-big"));
      return false;
    }

    clearError(fieldKey);
    return true;
  }

  /**
   * Validate that a value is a positive number
   */
  function validatePositiveNumber(
    value: string | number,
    field: string = "value"
  ): boolean {
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue) || numValue <= 0) {
      setError(field, t("message.invalid-balance-low"));
      return false;
    }

    clearError(field);
    return true;
  }

  /**
   * Create a reactive validation state for a form field
   */
  function useFieldValidation<T>(
    initialValue: T,
    validator: (value: T) => boolean
  ): {
    value: Ref<T>;
    error: Ref<string | null>;
    isValid: Ref<boolean>;
    validate: () => boolean;
    clear: () => void;
  } {
    const value = ref<T>(initialValue) as Ref<T>;
    const error = ref<string | null>(null);
    const isValid = computed(() => error.value === null);

    function validate(): boolean {
      const result = validator(value.value);
      return result;
    }

    function clear(): void {
      error.value = null;
    }

    return {
      value,
      error,
      isValid,
      validate,
      clear,
    };
  }

  return {
    // State
    errors,
    hasErrors,
    isAmountValid,
    isAddressValid,

    // Actions
    clearErrors,
    clearError,
    setError,

    // Validators
    validateAmount,
    validateAddress,
    validatePercentage,
    validatePositiveNumber,

    // Helpers
    useFieldValidation,
  };
}

/**
 * Standalone validation functions (for use outside composable)
 */
export const ValidationUtils = {
  /**
   * Check if a string is a valid decimal number
   */
  isValidDecimal(value: string): boolean {
    if (!value || value.trim() === "") return false;
    const decimalPattern = /^\d*\.?\d+$/;
    return decimalPattern.test(value);
  },

  /**
   * Check if a string is a valid integer
   */
  isValidInteger(value: string): boolean {
    if (!value || value.trim() === "") return false;
    const intPattern = /^\d+$/;
    return intPattern.test(value);
  },

  /**
   * Check if value is within range
   */
  isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  },

  /**
   * Check if address has valid bech32-like format
   */
  isValidBech32Format(address: string): boolean {
    const bech32Pattern = /^[a-z]+1[a-z0-9]{38,}$/;
    return bech32Pattern.test(address);
  },

  /**
   * Check if address starts with expected prefix
   */
  hasPrefix(address: string, prefix: string): boolean {
    return address.startsWith(prefix);
  },

  /**
   * Sanitize numeric input (remove invalid characters)
   */
  sanitizeNumericInput(value: string, allowDecimals: boolean = true): string {
    if (allowDecimals) {
      // Remove everything except digits and one decimal point
      return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    }
    return value.replace(/[^\d]/g, "");
  },
};
