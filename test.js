function calculateDynamicPNL({
  downpayment,
  loanMultiplier,
  open_price,
  close_price,
  repaymentTransactions = [],
  closeTransactions = [],
  liquidationTransactions = []
}) {
  const loan = loanMultiplier * downpayment; // Размер на заема
  const lease = loan + downpayment; // Общ капитал
  let totalAsset = lease / open_price; // Общо количество активи (ATOM)
  let remainingDebt = (loan * close_price) / open_price;

  closeTransactions.forEach((tx) => {
    // totalAsset -= tx.amount;
    remainingDebt -= tx.amount * tx.price;
  });

  // liquidationTransactions.forEach((tx) => {
  //   totalAsset -= tx.amount;
  //   remainingDebt -= tx.amount * tx.price;
  // });

  // repaymentTransactions.forEach((tx) => {
  //   remainingDebt -= tx.amount * tx.price;
  // });

  // console.log((close_price - open_price) * totalAsset);

  console.log(totalAsset);

  console.log(remainingDebt);

  const pnl = ((close_price - open_price) * totalAsset + remainingDebt + downpayment) * -1;

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
  open_price: 10,
  close_price: 8,
  repaymentTransactions: [
    // {
    //   amount: 15,
    //   price: 5
    // }
  ],
  closeTransactions: [
    {
      amount: 15,
      price: 5
    }
  ], // Пример за затваряне на 5 активи при цена 5
  liquidationTransactions: [
    // {
    //   amount: 2,
    //   price: 25
    // }
  ] // Пример за погасяване на 50 от заема
});

console.log("Loan:", result.loan);
console.log("Lease:", result.lease);
console.log("Position:", result.totalAsset);
console.log("Remaining Debt:", result.remainingDebt);
console.log("PNL:", result.pnl);
