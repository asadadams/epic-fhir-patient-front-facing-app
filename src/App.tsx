import FHIR from 'fhirclient';

function App() {

  const EPIC_CLIENT_ID = import.meta.env.VITE_EPIC_CLIENT_ID;
  const ISS = import.meta.env.VITE_ISS;
  const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

  console.log('Environment variables:');
  console.log(`EPIC_CLIENT_ID: ${EPIC_CLIENT_ID}`);
  console.log(`ISS: ${ISS}`);
  console.log(`REDIRECT_URI: ${REDIRECT_URI}`);


  const handleLogin = async () => {
    try {
      await FHIR.oauth2.authorize({
        client_id: `${EPIC_CLIENT_ID}`,
        scope: "launch openid profile patient/Observation.read patient/Condition.read patient/MedicationRequest.read offline_access",
        iss: `${ISS}` || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
        redirect_uri: `${REDIRECT_URI}` || 'http://localhost:5173/callback/',
      });
    } catch (err) {
      console.error('Launch failed', err);
    }
  };


  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SMART on FHIR Patient App </h1>

      <div>
        <p>Click the button below to log in as a patient.</p>
        <button onClick={handleLogin} style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
          🔑 Login with SMART (Patient)
        </button>
        <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
          <strong>Note:</strong> Make sure you have registered <code>http://localhost:5173/callback</code>{' '}
          (with the /callback path) as an allowed redirect URI in your Epic App Orchard registration.
        </p>
      </div>

    </div>
  );
}

export default App;
