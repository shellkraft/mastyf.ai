{{/*
Expand the name of the chart.
*/}}
{{- define "mastyff-ai.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mastyff-ai.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mastyff-ai.labels" -}}
helm.sh/chart: {{ include "mastyff-ai.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "mastyff-ai.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mastyff-ai.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mastyff-ai.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}