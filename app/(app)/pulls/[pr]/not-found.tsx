import { NotFoundView } from "@/components/app/NotFoundView";

export default function PullNotFound() {
  return <NotFoundView what="pull request check" back="/pulls" backLabel="Pull requests" />;
}
