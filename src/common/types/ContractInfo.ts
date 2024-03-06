export interface ContractInfo {
  instance: string;
  codeId: string;
}

export interface ContractAdminInfo extends ContractInfo {
  ignoreProtocols: string[];
}
