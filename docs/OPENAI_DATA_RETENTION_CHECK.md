# OpenAI API Data Retention Check

Checked against the official OpenAI API data controls documentation.

Current operating interpretation for Clinic Voice Room:

- API inputs and outputs are not used to train OpenAI models unless the API organization explicitly opts in.
- Abuse monitoring logs may contain customer content and are retained for up to 30 days by default.
- `/v1/realtime` and `/v1/audio/speech` are listed as not used for training, with 30-day abuse monitoring retention and no application state retention.
- Zero Data Retention or Modified Abuse Monitoring can reduce customer-content retention, but they require OpenAI approval and additional requirements.

Production note:

For a real hospital deployment, keep the patient notice visible and consider applying for Zero Data Retention or Modified Abuse Monitoring before expanding beyond a controlled pilot.

Source:

- https://platform.openai.com/docs/guides/your-data
