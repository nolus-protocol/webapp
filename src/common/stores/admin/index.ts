import type { State } from "@/common/stores/admin/types";
import { defineStore } from "pinia";
import { AdminActions } from "@/common/stores/admin/types";
import { actions } from "./actions";
import { getters } from "./getters";

const state = (): State => ({
  protocols: {}
});

const useAdminStore = defineStore("admin", {
  state,
  actions,
  getters
});

export { useAdminStore, AdminActions };
