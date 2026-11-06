// Decoy details (section 14.4 and 17). Fixed, fictional values the bank controls.
// Passed to the Decoy line as dynamic variables.
export const CANARY_VARIABLES = {
  customer_first: "Margaret",
  customer_last: "Wilson",
  decoy_card_number: "4000 0082 6000 0000",
  decoy_card_expiry: "09/29",
  decoy_card_cvc: "314",
  decoy_customer_number: "0811 5203 41",
  decoy_pin_digits: "first 4, second 7, fourth 2",
  decoy_otp: "731904",
};

export const CANARY_ISSUED = [
  { kind: "card" as const, label: "Card", masked: "ending 0000" },
  { kind: "login" as const, label: "Customer number", masked: "ending 41" },
  { kind: "otp" as const, label: "Passcode", masked: "issued once" },
];
