import { isDev } from "./modes";

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";

export const minimumLeaseAmount = 1;
export const POSITIONS = 5;
export const MIN_POSITION = 25;
export const MAX_POSITION = 150;
export const DEFAULT_LTD = 1.5;
export const FREE_INTEREST_ASSETS: string[] = [
  "AKT",
  "ATOM",
  "AXL",
  "CRO",
  "DYDX",
  "DYM",
  "EVMOS",
  "INJ",
  "JKL",
  "JUNO",
  "LVN",
  "milkTIA",
  "NTRN",
  "OSMO",
  "PICA",
  "qATOM",
  "SCRT",
  "STARS",
  "stkATOM",
  "STRD",
  "stATOM",
  "stOSMO",
  "stTIA",
  "TIA",
  "WBTC",
  "WETH",
  "CUDOS"
];
export const LEASE_DUE = 2 * 24 * 60 * 60 * 1000 * 1000 * 1000;
export const DOWNPAYMENT_RANGE_DEV = 15;

export const WASM_EVENTS = {
  "wasm-ls-request-loan": {
    key: "wasm-ls-request-loan",
    index: 0
  }
};

let DOWNPAYMENT_RANGE_URL: Promise<string> | string = import("../lease/downpayment-range.json?url").then(
  (t) => t.default
);
let SWAP_FEE_URL: Promise<string> | string = import("../lease/swap-fee?url").then((t) => t.default);
let FREE_INTEREST_ADDRESS_URL: Promise<string> | string = import("../zero/0interest-payments.json?url").then(
  (t) => t.default
);

if (!isDev()) {
  DOWNPAYMENT_RANGE_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/downpayment-range.json";
  SWAP_FEE_URL = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/swap-fee.json";
  FREE_INTEREST_ADDRESS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
}

export { DOWNPAYMENT_RANGE_URL, SWAP_FEE_URL, FREE_INTEREST_ADDRESS_URL };
export const IGNORE_LEASE_ASSETS: string[] = ["DYDX", "JUNO", "EVMOS", "STRD", "LVN", "DYM", "Q_ATOM", "STARS", "JKL"];
export const IGNORE_DOWNPAYMENT_ASSETS: string[] = [];

export const IGNORE_LEASES: string[] = [
  "nolus1suz0vsqe8c8anckaer98awhqs8r4hu7wsm8a49acdl39x6ylfypsqywxwh",
  "nolus1q2ekwjj87jglqsszwy6ah5t08h0k8kq67ed0l899sku2qt0dztpsnwt6sw",
  "nolus1qp2du2h4q52230l5v03nr8auc334l0c5s329gnuljlqudq5evzmqqw660f",
  "nolus1ppw9lmxjc244a735vp3q25e8g036qqpec092ghx5h3s69h73ctysmg78ku",
  "nolus1py0z9mr994yynhfvvvr04l5kzegtja2j3a5ck47tme7xfddk67eqzd2g6x",
  "nolus1pgqhntw0277eam23pq67w2nw4tkft2sz3mcypwf9y4uxu59hma3qqymnl7",
  "nolus1z3vm2mj0cl3s33svp84vg50rdqq36znlzuxt2fgv92mhgzf5f8qs48lp5f",
  "nolus1yuktyp8yfp76ufr78xqcvglu7kdzp0q4sfuhlhffwdg38swjertsr9ex6y",
  "nolus18c667lyy6dmvp4ufq8rnnglk4r3cyu4yndw30s80feyyr7dklqps3luynh",
  "nolus1gxyfrvtu6wjc6khqk6324ecf2v42l2k7vpxh9lep3v973dn3upls3pd2td",
  "nolus1f8rwxurzef4uvm27w22zgdd9feea4tk5fp4s82naanffafyw5waqwk00me",
  "nolus1fkgh8qsearyalrt6zzzhke44ugwtldj7yxwjgctm9nszprmec6wsv04x9c",
  "nolus127gv4gvd3fh6qx87ddsfdnkjgtne7j6pffp9rlgmnh53qvwlususmq3slv",
  "nolus1sx38zwmpsu5t7rcdgfxuds3mvcf3uj9kuqa05872qmwuca3etj8q8t5pke",
  "nolus1s4mmngsvxzludhqyq9rcw4g4k3ey6hyg403e23r5pw3e79vwzksswu7fwu",
  "nolus132g64mged5wtc2trn6yzhqz0ksvmrv7px2xcgnyem2hurpgtne5st9jqd3",
  "nolus1nkmvt7rr5n4zl009ez69uwj4sjtq7znnzgxfq26hp62vmmen497sn3wr6l",
  "nolus15kwdy833dhng9qzlry6gvmtnh66ymuhleggl00tr0l82yqfunmasd4vmtg",
  "nolus14sej8trutsax2p8km2p8frfrtxksuay3t7lac83unzl92295j0csrq4nrz",
  "nolus14adgmsgtmmqfpn80hrwp8gytjhdl9wdrqa0hu0h2lh9d5u9gjefq83up79",
  "nolus1kw5pcc7qsjxd4wlr7h8mtye040494ddtk38j8kl88zg34grehnzqdlyedf",
  "nolus1hganduv0pwhh3p9238j3gm5e3u58w04es4avlerzhtcnn7u2drqqhhk87n",
  "nolus1h0ewnf70kcl065yyu7j6dtxmqjq69ldd6lwl2z547sz0zfjzz7ns48vdye",
  "nolus1ava36r7r8h6es6p3swujxgee382amtsz7k26lchmuz5f9470kcaqhnk353",
  "nolus17z6dut67vsnuzvx4qvfzp2rtye0k6wqcp8dqchd69zpzmm32cs8stg7j7z",
  "nolus17z7d5lm6qy9mumjccwqxvh6cdmw4py3jmn28ef8hh4e6lvu9depqeswjl4",
  "nolus17y86accl3w9t9thqpusq2w0kjrq4zyvcuwtye32rrffr3k3h4c8qfvwvl6",
  "nolus1lcfamydusnj30h2cjtmws070jfz2jydr5gfv22s7hjvtyfq79p5qthyxhu",
  "nolus1zdgg6l6eu905x2lp9gyymelxl89zknzvrpf328j2dvvj6yk65d8qhs50qn",
  "nolus18h2arv8r0mrm8yxq4rfuqpxy2xjn7ft66mxneu6ml93cqkkxnz3qh5x5ns",
  "nolus1kdtrm04sumpe4ps0cxuzv5dta4fvzufajx5gcv6689sywq0d8weqf476ze",
  "nolus1ea2fvmfxe0d57wkcnqqlw8grwlpk82djt95zkq8mu343va80tkysztkhhr",
  "nolus1mje0rw3zmskd9lff0ylu5z680rp4q54achwwacdp66ye5vgtnrhssxj4sq"
];
