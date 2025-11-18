// components/TeamsGrid.tsx
import { Grid, Box } from '@mui/material';
import TeamIcon from '../TeamsComponent';

export interface Team {
  teamId: string;
  GSI_NAME: string;
  description?: string;
}

interface TeamsGridProps {
  teams: Team[];
  onInvite: () => void;
  onRemove: (teamId: string, teamName: string) => void;
  onDelete: (teamId: string, teamName: string) => void;
}

export default function TeamsGrid({ teams, onInvite, onRemove, onDelete }: TeamsGridProps) {
  return (
    <Grid
      container
      spacing={{ xs: 2, sm: 2.5, md: 3 }}
      justifyContent="flex-start"
      sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}
    >
      {teams.map((team) => (
        <Grid
          key={team.teamId}
          size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}
          sx={{ display: 'flex', justifyContent: 'center' }}
        >
          <Box sx={{ width: '100%' }}>
            <Box
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ width: '100%', height: '100%' }}>
                <TeamIcon
                  id={team.teamId}
                  name={team.GSI_NAME}
                  description={team.description}
                  onInvite={onInvite}
                  onRemove={() => onRemove(team.teamId, team.GSI_NAME)}
                  onDelete={() => onDelete(team.teamId, team.GSI_NAME)}
                />
              </Box>
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}