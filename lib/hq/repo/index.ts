import { isMultiUser } from "@/lib/hq/mode";
import { jsonRepo } from "@/lib/hq/repo/json";
import { supabaseRepo } from "@/lib/hq/repo/supabase";
import type { HqRepo } from "@/lib/hq/repo/types";

/**
 * The one place the repo implementation is chosen. Routes import named
 * functions from `@/lib/hq/repo` exactly as before — which backend answers
 * is decided by environment, per call. The Supabase client is only
 * constructed on first query, so local mode never needs the env vars.
 */

function repo(): HqRepo {
  return isMultiUser() ? supabaseRepo : jsonRepo;
}

export const getProfile: HqRepo["getProfile"] = (...a) => repo().getProfile(...a);
export const updateProfile: HqRepo["updateProfile"] = (...a) => repo().updateProfile(...a);
export const listCards: HqRepo["listCards"] = (...a) => repo().listCards(...a);
export const saveCard: HqRepo["saveCard"] = (...a) => repo().saveCard(...a);
export const deleteCard: HqRepo["deleteCard"] = (...a) => repo().deleteCard(...a);
export const replaceCards: HqRepo["replaceCards"] = (...a) => repo().replaceCards(...a);
export const listPostingViews: HqRepo["listPostingViews"] = (...a) =>
  repo().listPostingViews(...a);
export const getPostingView: HqRepo["getPostingView"] = (...a) => repo().getPostingView(...a);
export const upsertPosting: HqRepo["upsertPosting"] = (...a) => repo().upsertPosting(...a);
export const saveJdAnalysis: HqRepo["saveJdAnalysis"] = (...a) => repo().saveJdAnalysis(...a);
export const setPostingStatus: HqRepo["setPostingStatus"] = (...a) =>
  repo().setPostingStatus(...a);
export const getCompany: HqRepo["getCompany"] = (...a) => repo().getCompany(...a);
export const listApplications: HqRepo["listApplications"] = (...a) =>
  repo().listApplications(...a);
export const ensureApplication: HqRepo["ensureApplication"] = (...a) =>
  repo().ensureApplication(...a);
export const patchApplication: HqRepo["patchApplication"] = (...a) =>
  repo().patchApplication(...a);
export const getTimeline: HqRepo["getTimeline"] = (...a) => repo().getTimeline(...a);
export const listContacts: HqRepo["listContacts"] = (...a) => repo().listContacts(...a);
export const createContact: HqRepo["createContact"] = (...a) => repo().createContact(...a);
export const patchContact: HqRepo["patchContact"] = (...a) => repo().patchContact(...a);
export const deleteContact: HqRepo["deleteContact"] = (...a) => repo().deleteContact(...a);
export const saveCompanyNote: HqRepo["saveCompanyNote"] = (...a) =>
  repo().saveCompanyNote(...a);
export const getMatch: HqRepo["getMatch"] = (...a) => repo().getMatch(...a);
export const saveMatch: HqRepo["saveMatch"] = (...a) => repo().saveMatch(...a);
export const getResearchBrief: HqRepo["getResearchBrief"] = (...a) =>
  repo().getResearchBrief(...a);
export const saveResearchBrief: HqRepo["saveResearchBrief"] = (...a) =>
  repo().saveResearchBrief(...a);
export const saveResumeVersion: HqRepo["saveResumeVersion"] = (...a) =>
  repo().saveResumeVersion(...a);
export const listResumeVersions: HqRepo["listResumeVersions"] = (...a) =>
  repo().listResumeVersions(...a);
export const recordUsage: HqRepo["recordUsage"] = (...a) => repo().recordUsage(...a);
export const monthlyUsage: HqRepo["monthlyUsage"] = (...a) => repo().monthlyUsage(...a);
