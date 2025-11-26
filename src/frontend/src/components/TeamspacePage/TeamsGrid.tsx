// components/TeamsGrid.tsx
import { Grid, Box } from '@mui/material';
import TeamIcon from './TeamsComponent';

export interface Team {
  teamId: string;
  GSI_NAME: string;
  description?: string;
  percent?: number; 
}


interface TeamsGridProps {
  teams: Team[];
  onInvite: () => void;
  onRemove: (teamId: string, teamName: string) => void;
  onDelete: (teamId: string, teamName: string) => void;
  onViewMembers: (teamId: string, teamName: string) => void;
}

export default function TeamsGrid({
  teams,
  onInvite,
  onRemove,
  onDelete,
  onViewMembers,
}: TeamsGridProps) {
  return (
    <Grid
      container
      spacing={{ xs: 2, sm: 2.5, md: 3 }}
      sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}
    >
      {teams.map((team) => (
        <Grid
          key={team.teamId}
          size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}
        >
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1 / 1',
              display: 'flex',
              '& > *': {
                width: '100%',
                height: '100%',
                minWidth: 0,
              },
            }}
          >
            <TeamIcon
              id={team.teamId}
              name={team.GSI_NAME}
              description={team.description}
              percent={team.percent ?? 0}    
              onInvite={onInvite}
              onRemove={() => onRemove(team.teamId, team.GSI_NAME)}
              onDelete={() => onDelete(team.teamId, team.GSI_NAME)}
              onViewMembers={() => onViewMembers(team.teamId, team.GSI_NAME)}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}