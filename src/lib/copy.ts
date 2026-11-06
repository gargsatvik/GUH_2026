// All user-facing strings (section 22). Plain English, no emojis, and never
// the words AI, agent, model, prompt or similar.

export const DISCLAIMER = "Concept demo built at GreatUniHack 2026. Not a NatWest product. All data is fictional.";

export const DECOY_NUMBER = "0808 157 0614";

/** Timeline titles (section 22.2). */
export const T = {
  callStarted: "Customer is on a phone call",
  checkScam: "Customer checked a call: not from NatWest",
  checkGenuine: "Customer checked a call: genuine NatWest call",
  decoyRequested: "Customer passed the caller to Decoy",
  decoyConnected: "Decoy answered as the customer's son",
  captureAccount: (display: string, label: string | null) =>
    label ? `Captured account ${display} (${label})` : `Captured account ${display}`,
  capturePhone: (d: string) => `Captured callback number ${d}`,
  captureUrl: (d: string) => `Captured link ${d}`,
  captureWallet: (d: string) => `Captured wallet ${d}`,
  captureAlias: (d: string) => `Captured caller name ${d}`,
  matchEarlier: (d: string, n: number) => `${d} was used in ${n} earlier reported call${n === 1 ? "" : "s"}`,
  linkedCampaign: (c: string) => `Call linked to campaign: ${c}`,
  flag: (d: string) => `Account ${d} blocked for incoming payments`,
  paymentPaused: (amount: string, d: string, ago: string) => `Payment of ${amount} to ${d} paused. Account reported ${ago}.`,
  paymentSent: (amount: string, d: string) => `Payment of ${amount} sent to ${d}`,
  decoyEnded: (duration: string) => `Decoy call ended after ${duration}`,
  reportSent: "Fraud report sent to Fraud Operations",
  canaryCard: (amount: string) => `Decoy card used: ${amount} purchase attempt declined`,
  canaryLogin: "Decoy login used: sign-in attempt blocked",
  canaryWatch: "Device and location added to watch list",
  automationOffline: "Automation offline, handled directly",
  demoReset: "Demo reset",
  noteScamNumber: (d: string) => `Added ${d} to the scam number list`,
  noteLink: "Added link to the suspicious sites list",
  noteWallet: "Recorded wallet",
  noteAlias: "Recorded caller name",
  allyAsked: "Claire has been asked to check this payment",
  allyStopped: "Claire stopped the payment",
  allyApproved: "Claire let the payment go",
  paymentCancelled: "Customer cancelled the paused payment",
  coaching: (level: string) => `Coaching check: signs of coaching ${level}`,
};

export const COPY = {
  landing: {
    title: "Decoy",
    line: "Every scam call becomes protection for the next customer.",
    cards: [
      { href: "/app", title: "Customer app (phone)", body: "Check a call, pass the caller to Decoy and make payments." },
      { href: "/caller", title: "Caller console (laptop)", body: "Play the caller. Your voice goes to the Decoy line." },
      { href: "/ops", title: "Fraud Operations (projector)", body: "Watch details arrive, connect and get blocked live." },
    ],
  },
  banner: {
    title: "You're on a phone call",
    body: "If the caller says they're from NatWest, check it here. It only takes a second.",
    button: "Check this call",
  },
  checking: { title: "Checking with NatWest", body: "We're looking for any NatWest colleague on a call with you." },
  genuine: {
    title: "This call is from NatWest",
    body: (name: string) => `You're speaking to ${name} from our Fraud Team.`,
    codeLabel: "Your call code",
    codeBody: (name: string) => `Ask ${name} to read this code to you. It's on her screen too.`,
    done: "Done",
  },
  notNatwest: {
    title: "This call is not from NatWest",
    body: "No one at NatWest is calling you right now. The caller may be using our name or even our phone number.",
    emphasis: "NatWest will never ask you to move money to keep it safe.",
    pass: "Pass this call to Decoy",
    passHelp: "Decoy takes over the call, keeps the caller busy and records what they ask for, so we can stop them.",
    hangUp: "Hang up and report",
    whatIs: "What is Decoy?",
    whatIsBody:
      "Decoy is a NatWest line that answers scam calls for you. It sounds like a family member, so the caller keeps talking. Everything they ask for helps us block their accounts and protect other customers. You don't need to say anything.",
  },
  noCall:
    "You're not on a call with NatWest right now. If someone says they're from NatWest, hang up and call us on the number on the back of your card.",
  pass: {
    title: "Pass the call to Decoy",
    sub: "Three steps. Takes about ten seconds.",
    step1: "Say to the caller",
    quote: "Hold on, let me get my son. He looks after my banking.",
    step2: "Call the Decoy line. Your phone will put the caller on hold.",
    call: "Call Decoy",
    connecting: "Connecting to Decoy",
    step3: "When Decoy answers, tap Merge, then mute yourself. Stay on mute until the call ends.",
    still: "Still connecting...",
  },
  live: {
    pill: "Live",
    title: "Decoy is on the line",
    captured: (n: number) => `Details captured: ${n}`,
    card: "You can stay on mute. You don't need to say anything. Don't hang up: on some phones that ends the call for everyone.",
    leave: "Leave the call",
  },
  summary: {
    title: (first: string) => `Thank you, ${first}`,
    body: (d: string) => `Decoy kept the caller busy for ${d}.`,
    rows: [
      "We've blocked the account they wanted you to pay.",
      "We've reported the caller to our fraud team.",
      "Your money is safe. Nothing has left your accounts.",
    ],
    home: "Back to home",
  },
  pay: {
    title: "Pay someone new",
    name: "Name",
    sort: "Sort code",
    account: "Account number",
    amount: "Amount",
    reference: "Reference (optional)",
    continue: "Continue",
    review: "Check the details",
    payButton: (amount: string) => `Pay ${amount}`,
    errSort: "Enter a 6-digit sort code",
    errAccount: "Enter an 8-digit account number",
    errAmount: "Enter an amount",
    errName: "Enter a name",
  },
  interrupt: {
    title: "You're on a phone call",
    body: "NatWest will never ask you to move money to keep it safe. Is someone on the phone asking you to make this payment?",
    check: "Check the call",
    cont: "No, continue",
  },
  paused: {
    title: "We've paused this payment",
    body: (ago: string) => `This account was reported in a scam call ${ago}. Money sent to it is very unlikely to come back.`,
    linked: (c: string) => `Linked to: ${c}`,
    emphasis: "If someone on the phone asked you to make this payment, it's a scam. Hang up.",
    cancel: "Cancel this payment",
    talk: "Talk to us",
    ally: "We've let Claire, your trusted contact, know.",
    cancelled: "Payment cancelled. Nothing has left your account.",
  },
  sent: { title: "Payment sent", done: "Done" },
  errors: {
    network: "Something went wrong. Check your connection and try again.",
    check: "We couldn't check this call. If you're unsure, hang up and call the number on the back of your card.",
    voice: "Could not reach the Decoy line. Press Reconnect, or switch to replay on the dashboard.",
    mic: "Microphone blocked. Allow microphone access in the browser bar and press Arm line again.",
  },
  ops: {
    idle: "No live calls. The Decoy line is ready.",
    noDetails: "Nothing captured yet. Details appear here as the caller gives them.",
    noTimeline: "No actions yet today.",
    reconnecting: "Reconnecting...",
  },
  protect: {
    title: "A quick check before this payment",
    intro: "We'd like to ask you four short questions. It takes about a minute.",
    questions: [
      "What is this payment for?",
      "How did you find out about it?",
      "Has anyone asked you to make it, or told you what to say to us?",
      "Is anyone on another phone or in the room with you now?",
    ],
    thanks: "Thank you. A specialist will look at this payment within the hour.",
  },
};
