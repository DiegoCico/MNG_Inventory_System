import RestartProcess from '../RestartProcess';

interface RestartInventoryProcessProps {
  teamId: string;
}

export default function RestartInventoryProcess({ teamId }: RestartInventoryProcessProps) {
  return <RestartProcess teamId={teamId} onRestart={() => window.location.reload()} />;
}
