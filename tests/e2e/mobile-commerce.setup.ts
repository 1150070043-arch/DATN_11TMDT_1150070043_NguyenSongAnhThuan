export default async function auditOnly() {
  const response = await fetch('http://localhost:4002/api/health');
  const body = await response.json() as { data?: { auditFixture?: boolean } };
  if (!response.ok || body.data?.auditFixture !== true) {
    throw new Error('Mobile commerce tests require docker-compose.audit.yml; regular databases must not be mutated.');
  }
}
