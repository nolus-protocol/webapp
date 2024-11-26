function calculateDynamicPNL({
  downpayment,
  loanMultiplier,
  close_price,
  atomClosePrice,
  closeTransactions = [],
  liquidationTransactions = []
}) {
  const loan = loanMultiplier * downpayment; // Размер на заема
  const lease = loan + downpayment; // Общ капитал
  let totalAsset = lease / close_price; // Общо количество активи (ATOM)
  let remainingDebt = (loan * atomClosePrice) / close_price;

  closeTransactions.forEach((tx) => {
    totalAsset -= tx.amount;
    remainingDebt -= tx.amount * tx.price;
  });

  liquidationTransactions.forEach((tx) => {
    totalAsset -= tx.amount;
    remainingDebt -= tx.amount * tx.price;
  });

  const pnl = (atomClosePrice - close_price) * totalAsset + remainingDebt + downpayment;

  return {
    loan,
    lease,
    totalAsset,
    remainingDebt,
    pnl
  };
}

// Пример за използване
const result = calculateDynamicPNL({
  downpayment: 100,
  loanMultiplier: 1.5,
  close_price: 10,
  atomClosePrice: 5,
  closeTransactions: [
    {
      amount: 1,
      price: 9
    },
    {
      amount: 1,
      price: 15
    }
  ], // Пример за затваряне на 5 активи при цена 5
  liquidationTransactions: [
    {
      amount: 2,
      price: 25
    }
  ] // Пример за погасяване на 50 от заема
});

console.log("Loan:", result.loan);
console.log("Lease:", result.lease);
console.log("Position:", result.totalAsset);
console.log("Remaining Debt:", result.remainingDebt);
console.log("PNL:", result.pnl);
