import { supabaseFmsService } from "@/services/supabase";

export interface LocationOption {
  id: number;
  code: string;
  name: string;
}

export interface WorkshiftOption {
  id: number;
  name: string;
}

const WORKSHIFT_TABLE = "fms_app_data_workshifts";
const LOCATION_TABLE = "fms_mst_locations";

export const getLocationsByProject = async (
  projectCode: string
): Promise<LocationOption[]> => {
  const { data, error } = await supabaseFmsService.client
    .from(LOCATION_TABLE)
    .select("id, code, name")
    .eq("project_code", projectCode)
    .order("name", { ascending: true })
    .limit(1000);

  if (error) {
    throw error;
  }

  return (data || []) as LocationOption[];
};

export const getWorkshiftsByProject = async (
  projectCode: string
): Promise<WorkshiftOption[]> => {
  const { data, error } = await supabaseFmsService.client
    .from(WORKSHIFT_TABLE)
    .select("id, name")
    .eq("project_code", projectCode)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  return (data || []) as WorkshiftOption[];
};
