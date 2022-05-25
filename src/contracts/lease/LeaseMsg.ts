export const getDownpayment = (amount: string, denom: string) => {
  return {
    quote: {
      downpayment: {
        denom: denom,
        amount: amount
      }
    }
  }
}

export const openLease = (denom: string) => {
  return {
    open_lease: {
      currency: denom
    }
  }
}

export const getCurrentOpenLeases = (address: string) => {
  return {
    quote: {
      owner: address
    }
  }
}
