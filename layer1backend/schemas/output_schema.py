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


class Layer1Output(BaseModel):
	model_config = ConfigDict(extra="forbid")

	metadata: MetadataOutput
	steganography: SteganographyOutput
	prnu: PRNUOutput
	layer1_score: float
