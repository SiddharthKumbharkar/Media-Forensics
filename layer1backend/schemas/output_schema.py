from pydantic import BaseModel, ConfigDict


class MetadataOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	exif_consistent: bool
	physics_violations: list[str]
	exif_score: float


class SteganographyOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	lsb_anomaly: bool
	dct_anomaly: bool
	steg_score: float


class PRNUOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	noise_variance: float
	spatial_correlation: float
	prnu_score: float


class C2PAOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	c2pa_present: bool
	c2pa_verified: bool
	c2pa_score: float
	note: str


class MLPredictionOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	label: str
	confidence: float
	model: str


class ForensicSignalsOutput(BaseModel):
	model_config = ConfigDict(extra="forbid")

	c2pa: C2PAOutput
	exif_score: float
	steg_score: float
	prnu_score: float
	exif_consistent: bool
	lsb_anomaly: bool
	dct_anomaly: bool


class Layer1Output(BaseModel):
	model_config = ConfigDict(extra="forbid")

	authenticity_score: float
	verdict: str
	ml_prediction: MLPredictionOutput
	forensic_signals: ForensicSignalsOutput
	c2pa: C2PAOutput
	metadata: MetadataOutput
	steganography: SteganographyOutput
	prnu: PRNUOutput
	layer1_score: float
