import { ETL_API } from "@/config/env";
import type { IObjectKeys } from "@/types";

export class EtlApi {

    static async fetchEarnApr(protocol: string): Promise<IObjectKeys> {
        return fetch(`${ETL_API}/earn-apr?protocol=${protocol}`).then((data) => data.json());
    }

    static async fetchLeaseOpening(leaseAddres: string): Promise<IObjectKeys> {
        return fetch(`${ETL_API}/ls-opening?lease=${leaseAddres}`).then((data) => data.json());
    }
}