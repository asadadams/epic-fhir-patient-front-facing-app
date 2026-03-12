import { useEffect, useRef, useState } from "react";
import FHIR from "fhirclient";

interface PatientData {
  patient?: any;
  resources?: Record<string, any>;  // renamed from everything for clarity
  loading: boolean;
  error?: string;
}

export default function Callback() {
  const isInitialMount = useRef(true);
  const [client, setClient] = useState<any>(null);
  const [data, setData] = useState<PatientData>({
    loading: true,  // start as loading
    error: undefined,
  });

  const [obsLoading, setObsLoading] = useState(false); // separate loading for Observation

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;

      FHIR.oauth2.ready()
        .then((smart) => {
          console.log("SMART client ready:", smart);
          console.log("Patient ID:", smart.patient?.id);
          console.log("Token expires in:", smart.state?.tokenResponse?.expires_in);

          setClient(smart);

          fetchPatientData(smart);
        })
        .catch((err) => {
          console.error("oauth2.ready failed — probably no active launch or token expired:", err);
          setData({
            loading: false,
            error: "Authorization failed or session expired. Please go back and login again.",
          });
        });
    }
  }, []);

  const fetchPatientData = async (smartClient: any) => {
    if (!smartClient) return;

    setData((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      // Get patient (this almost always works if token is valid)
      const patient = await smartClient.patient.read();
      console.log("Patient:", patient.id);

      setData({
        patient,
        loading: false,
      });
    } catch (err: any) {
      console.error("Fetch error:", err);
      const msg =
        err.status === 401
          ? "401 Unauthorized — token expired or invalid. Try logging in again."
          : err.message || "Failed to load patient data";

      setData({
        loading: false,
        error: msg,
      });
    }
  };

  const fetchObservationResource = async () => {
    if (!client || !data.patient) return;

    console.log("SMART client ready:", client);
    console.log("Patient ID:", client.patient?.id);
    console.log("Token expires in:", client.state?.tokenResponse?.expires_in);
    console.log("Token scopes:", client.state?.tokenResponse?.scope);

    setObsLoading(true); // start Observation loading

    const results: Record<string, any> = {};

    try {
      const bundle = await client.request(
        `Observation?patient=${client.patient.id}&limit=50&category=laboratory`,
        {
          pageLimit: 0, // get all pages
          flat: true,   // optional: flattens bundle entries
        }
      );

      results['Observation'] = bundle;
      console.log(`Observation count:`, bundle?.length || 0);
    } catch (err: any) {
      console.warn(`FailedObservation:`, err.message);
      results['Observation'] = { error: err.message };
    }

    setData((prev) => ({
      ...prev,
      resources: results,
    }));

    setObsLoading(false); // end Observation loading
  };

  if (data.loading) {
    return (
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <h2>Logged in → Loading your health data...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>SMART on FHIR Patient App</h1>

      {data.error ? (
        <div>
          <h2 style={{ color: "red" }}>Error</h2>
          <p>{data.error}</p>
          <p>
            <strong>Tip:</strong> Try logging in again from the <a href="/">home page</a>.
          </p>
        </div>
      ) : (
        <>
          <h2>✅ Patient data loaded</h2>

          {data.patient && (
            <div style={{ margin: "2rem 0" }}>
              <h3>Patient Information</h3>
              <pre style={{ maxHeight: "300px", overflow: "auto" }}>
                {JSON.stringify(data.patient, null, 2)}
              </pre>
            </div>
          )}

          <button
            onClick={fetchObservationResource}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
              marginBottom: "20px",
            }}
            disabled={obsLoading}
          >
            {obsLoading ? "Fetching Observations..." : "Get Observations"}
          </button>

          {obsLoading && <p>Loading Observation data...</p>}

          {data.resources && Object.keys(data.resources).length > 0 && (
            <div>
              <h3>Fetched Resources</h3>
              {Object.entries(data.resources).map(([type, res]) => (
                <div key={type} style={{ marginBottom: "2rem" }}>
                  <h4>{type} ({res?.length || 0} items)</h4>
                  <pre style={{ maxHeight: "300px", overflow: "auto" }}>
                    {JSON.stringify(res, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}