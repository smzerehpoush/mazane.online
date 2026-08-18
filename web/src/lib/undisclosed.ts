/**
 * ⚠️ One place for the sentences that stand in for a value we do not have.
 * Two different admissions live here and they must not be swapped: the fee
 * sentences say **the platform** never published the number, the collection
 * sentences say **we** have not gathered it yet. Neither may ever be replaced
 * by a dash, «نامشخص» or «ثبت نشده است» — those read as a claim about the
 * platform instead of an admission, which is the opposite of what is true.
 */
export const FEES_UNDISCLOSED_FA = "این سکو کارمزدش را عمومی اعلام نکرده است";
export const FEE_UNDISCLOSED_FA = "این سکو اعلام نکرده است";
export const MIN_ORDER_UNCOLLECTED_FA = "هنوز بررسی نکرده‌ایم";

/**
 * ⚠️ The bubble gauge's risk badge has no platform behind it at all — it is
 * missing an **input** (the ounce or dollar leg), not a number a platform
 * withheld. «نامشخص» read as if the risk itself were indeterminate; this
 * names the actual gap instead.
 */
export const BUBBLE_INPUT_MISSING_FA = "داده‌ی ورودی حباب هنوز کامل نیست";

/**
 * ⚠️ Same "we", not "them" admission as `MIN_ORDER_UNCOLLECTED_FA`, but for a
 * coin price we read from the reference feed, never a platform.
 */
export const COIN_PRICE_UNCOLLECTED_FA = "هنوز داده‌ای ثبت نشده است";
