import { NotFoundView } from "@/components/app/NotFoundView";

export default function IncidentNotFound() {
  return <NotFoundView what="incident" back="/incidents" backLabel="Incidents" />;
}
