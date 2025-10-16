import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHelloMessage } from '../api/api';

const features = [
  { title: 'Dashboard', description: 'A snapshot of metrics.' },
  { title: 'Mobile', description: 'Access from mobile.' },
  { title: 'All platforms', description: 'Web, mobile, desktop.' },
];

function HeroPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedFeature = features[selectedIndex];

  const [msg, setMsg] = useState('loading...');

  useEffect(() => {
    getHelloMessage()
      .then(setMsg)
      .catch(() => setMsg('API not running'));
  }, []);

  return (
    <div className="HeroPage">
      <AppBar>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            App
          </Typography>
          <Button
            component={Link}
            to="/signin"
            variant="contained"
            sx={{ bgcolor: 'primary.main' }}
          >
            Sign In
          </Button>
          <Button
            component={Link}
            to="/signup"
            variant="contained"
            sx={{ bgcolor: 'secondary.main', marginLeft: 4 }}
          >
            Sign Up
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 15 }}>
        <Typography
          variant="h2"
          sx={{
            textAlign: 'center',
          }}
          gutterBottom
        >
          {' '}
          File tracking made easy.
        </Typography>
        <Typography
          variant="h5"
          sx={{ textAlign: 'center', color: 'text.secondary', paddingBottom: 5 }}
        >
          {msg}
        </Typography>
        <Typography variant="h4" gutterBottom>
          Product Features
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Key feature under text.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Left side - buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {features.map((feature, index) => (
              <Button
                key={index}
                variant={selectedIndex === index ? 'contained' : 'outlined'}
                onClick={() => setSelectedIndex(index)}
              >
                {feature.title}
              </Button>
            ))}
          </Box>

          {/* Right side - selected feature */}
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6">{selectedFeature.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedFeature.description}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </div>
  );
}

export default HeroPage;
