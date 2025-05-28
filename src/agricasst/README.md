# ClyCites Agric-Assistant

AI-powered agricultural assistant microservice that provides intelligent farming recommendations, weather insights, and crop management guidance.

## Features

- **Weather Integration**: Real-time weather data with agricultural metrics
- **Crop Recommendations**: AI-driven crop suggestions based on climate conditions
- **Irrigation Management**: Smart irrigation recommendations
- **Pest & Disease Management**: Identification and treatment recommendations
- **Market Intelligence**: Crop pricing and demand insights
- **Multilingual Support**: Ready for localization

## Architecture

\`\`\`
app/
├── controllers/          # Request handlers
├── models/              # Database schemas
├── routes/              # API route definitions
├── services/            # Business logic
├── middleware/          # Custom middleware
└── utils/               # Utility functions
config/                  # Configuration files
scripts/                 # Database seeding and utilities
logs/                    # Application logs
\`\`\`

## API Endpoints

### Weather
- `GET /api/weather/current` - Current weather and forecast
- `GET /api/weather/agricultural-metrics` - Agricultural-specific metrics
- `GET /api/weather/alerts` - Weather alerts for farming

### Recommendations
- `GET /api/recommendations/crops` - Crop recommendations
- `GET /api/recommendations/irrigation` - Irrigation advice
- `GET /api/recommendations/planting` - Planting guidance
- `GET /api/recommendations/fertilizer` - Fertilizer recommendations
- `GET /api/recommendations/pest-management` - Pest control advice

### Crops
- `GET /api/crops` - List all crops with filtering
- `GET /api/crops/:id` - Get specific crop details
- `GET /api/crops/search/:name` - Search crops by name

### Alerts
- `GET /api/alerts` - Get active alerts
- `PATCH /api/alerts/:id/dismiss` - Dismiss alert

## Setup

1. **Clone and Install**
   \`\`\`bash
   git clone <repository>
   cd clycites-agric-assistant
   npm install
   \`\`\`

2. **Environment Setup**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. **Database Setup**
   \`\`\`bash
   # Start MongoDB
   mongod
   
   # Seed sample data
   npm run seed
   \`\`\`

4. **Start Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `AUTH_SERVER_URL` | Authentication server URL | No |
| `ALLOWED_ORIGINS` | CORS allowed origins | No |

## Integration with Auth Server

The service integrates with your existing authentication system:

1. **Token Validation**: Validates JWT tokens from your auth server
2. **User Context**: Extracts user information from tokens
3. **Role-based Access**: Supports role-based permissions

## Agricultural Metrics

The system calculates advanced agricultural metrics:

- **Growing Degree Days**: Heat accumulation for crop development
- **Evapotranspiration**: Water loss estimation
- **Soil Temperature**: Multi-depth soil temperature estimates
- **Heat Stress Index**: Crop stress assessment
- **Moisture Index**: Soil moisture estimation

## Weather Alerts

Automated alerts for:
- Frost warnings
- Drought conditions
- Heat waves
- High winds
- Pest-favorable conditions

## Development

\`\`\`bash
# Run tests
npm test

# Run with file watching
npm run dev

# Lint code
npm run lint

# Clear logs
npm run logs:clear
\`\`\`

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production MongoDB
3. Set up log rotation
4. Configure reverse proxy (nginx)
5. Set up monitoring and health checks

## API Documentation

Visit `/api` endpoint for API overview and available endpoints.

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - see LICENSE file for details.
