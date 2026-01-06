# 🗺️ Google Maps Resolver

Resolve destination coordinates using Google Maps Directions API without API key.

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run start:dev
```

The server will start on `http://localhost:9000` with hot reload enabled.

### Production Build

```bash
npm run build
npm run start:prod
```

---

## 📡 API Documentation

### POST `/maps/resolve-place`

Resolve a destination's coordinates from a text address or place name.

#### Request Body

```json
{
  "originLat": 10.762622,
  "originLng": 106.660172,
  "destination": "Bến Thành Market, Quận 1, TP.HCM"
}
```

**Parameters:**
- `originLat` (number, required): Origin latitude (-90 to 90)
- `originLng` (number, required): Origin longitude (-180 to 180)
- `destination` (string, required): Destination name or address

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "resolvedName": "Chợ Bến Thành - Quận 1 - Hồ Chí Minh",
    "lat": 10.772461,
    "lng": 106.698055,
    "source": "google_maps_dir",
    "url": "https://www.google.com/maps/dir/10.762622,106.660172/B%E1%BA%BF..."
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid coordinates
```json
{
  "statusCode": 400,
  "message": "Invalid origin coordinates"
}
```

**404 Not Found** - Destination not found
```json
{
  "statusCode": 404,
  "message": "Cannot resolve place: Google Maps structure changed or destination not found"
}
```

**408 Request Timeout** - Request took too long
```json
{
  "statusCode": 408,
  "message": "Request timeout: Google Maps took too long to respond"
}
```

**502 Bad Gateway** - Google Maps error
```json
{
  "statusCode": 502,
  "message": "Failed to fetch from Google Maps: Service Unavailable"
}
```

**503 Service Unavailable** - Network error
```json
{
  "statusCode": 503,
  "message": "Cannot connect to Google Maps"
}
```

---

## 🧪 Testing with cURL

### Basic request
```bash
curl -X POST http://localhost:9000/maps/resolve-place \
  -H "Content-Type: application/json" \
  -d "{
    \"originLat\": 10.762622,
    \"originLng\": 106.660172,
    \"destination\": \"Bến Thành Market\"
  }"
```

### Vietnamese location
```bash
curl -X POST http://localhost:9000/maps/resolve-place \
  -H "Content-Type: application/json" \
  -d "{
    \"originLat\": 21.028511,
    \"originLng\": 105.804817,
    \"destination\": \"Hồ Hoàn Kiếm, Hà Nội\"
  }"
```

### International location
```bash
curl -X POST http://localhost:9000/maps/resolve-place \
  -H "Content-Type: application/json" \
  -d "{
    \"originLat\": 10.762622,
    \"originLng\": 106.660172,
    \"destination\": \"Times Square, New York\"
  }"
```

---

## 🏗️ Project Structure

```
google-maps-resolver/
├── src/
│   ├── main.ts                 # Application entry point with ValidationPipe
│   ├── app.module.ts           # Root module
│   └── maps/
│       ├── maps.controller.ts  # REST API controller with logging
│       ├── maps.service.ts     # Business logic with error handling
│       └── dto/
│           └── resolve-place.dto.ts  # Request validation
├── dist/                       # Compiled output
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

---

## 🔧 Configuration

### Environment Variables

- `PORT` (optional): Server port, defaults to 9000

### Timeout Configuration

Request timeout is set to 10 seconds in `MapsService`. To change:

```typescript
// src/maps/maps.service.ts
private readonly REQUEST_TIMEOUT = 10000; // milliseconds
```

---

## 📝 Logging

The application includes comprehensive logging:

- **Bootstrap**: Application startup information
- **Controller**: Incoming requests
- **Service**: Resolution process, errors, and debug information

Log levels can be adjusted in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'error', 'warn', 'debug', 'verbose'],
});
```

---

## ⚠️ Important Notes

1. **No API Key Required**: This service uses Google Maps web scraping, no API key needed
2. **Rate Limiting**: Google may rate-limit requests from the same IP
3. **Structure Changes**: If Google changes their HTML structure, the regex pattern may need updates
4. **CORS Enabled**: API accepts requests from any origin
5. **Validation**: All inputs are validated using class-validator

---

## 🐛 Known Limitations

- Depends on Google Maps HTML structure (og:image meta tag)
- May be affected by Google's rate limiting
- Requires internet connection to Google Maps
- Response time depends on Google Maps server

---

## 📦 Dependencies

### Runtime
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` - NestJS framework
- `node-fetch` - HTTP client
- `cheerio` - HTML parsing
- `class-validator`, `class-transformer` - Input validation
- `reflect-metadata`, `rxjs` - Required by NestJS

### Development
- `@nestjs/cli` - NestJS CLI tools
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution
- `@types/node` - Node.js type definitions

---

## 👨‍💻 Development

### Adding new features

1. Create new DTO in `src/maps/dto/`
2. Add validation decorators from `class-validator`
3. Implement service logic in `src/maps/maps.service.ts`
4. Add controller endpoint in `src/maps/maps.controller.ts`
5. Add error handling and logging

### Code style

- Use NestJS decorators (`@Injectable()`, `@Controller()`, etc.)
- Enable strict validation on all DTOs
- Log all important operations
- Handle all error cases with proper HTTP status codes
- Use TypeScript strict types

---

## 📄 License

MIT

---

## 🆘 Support

For issues or questions, please check:
1. Application logs for detailed error messages
2. Validate input coordinates are within valid ranges
3. Ensure destination string is properly formatted
4. Check network connectivity to Google Maps

---

**Last Updated**: 2026-01-06
**Version**: 1.0.0
**Status**: ✅ All bugs fixed and tested
