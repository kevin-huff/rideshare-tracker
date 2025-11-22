# Rideshare Tracker - Documentation

This directory contains technical documentation, testing guides, and implementation notes for the Rideshare Tracker project.

## Contents

### [Device Testing Guide](./device_testing_guide.md)
Comprehensive guide for testing the Phase 2.1 Mobile Core on physical Android devices. Covers setup, configuration, and detailed test scenarios for all features including offline mode and background location tracking.

## Project Documentation

- **[Project Plan](../project_plan.md)** - Overall project phases and architecture
- **[Progress Tracker](../progress.md)** - Current development status

## Related Documentation

### Server
- API documentation: See `server/README.md` (if exists)
- Database schema: `server/schema.sql`

### Mobile
- See `mobile/README.md` for build instructions
- Component documentation: See inline JSDoc in source files
- Map stack: MapLibre GL via `@rnmapbox/maps` v10.x (chosen for RN 0.73 compatibility; v11 has peer conflicts)

## Contributing

When adding new documentation:
1. Use clear, descriptive filenames
2. Include a summary in this README
3. Use Markdown formatting
4. Link to related docs where appropriate
