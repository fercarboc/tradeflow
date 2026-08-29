# VeriFactu — Validación XSD Local

Scripts para validar el XML generado por `buildVerifactuXml` contra los
esquemas XSD oficiales de la AEAT antes de cualquier envío a producción.

## Esquemas XSD oficiales

Descargar de la AEAT (Orden HAC/1177/2024):
- `SuministroInformacion.xsd`
- `SuministroLR.xsd`
- `RespuestaSuministro.xsd`

URL de descarga: https://www.agenciatributaria.es/AEAT.internet/Inicio/La_Agencia_Tributaria/Campanas/Facturacion_informatizada_obligatoria/Informacion_tecnica/Informacion_tecnica.shtml

## Cómo validar

1. Descargar los XSD en este directorio.
2. Generar XML de prueba usando `buildVerifactuXml` (src/lib/verifactu/buildVerifactuXml.ts).
3. Validar con xmllint (Linux/Mac) o Saxon (Windows):

```bash
# Con xmllint
xmllint --schema SuministroLR.xsd --noout test_registro_alta.xml

# Con Saxon (Windows)
java -jar saxon-he.jar -validate:on -s:test_registro_alta.xml -xsd:SuministroLR.xsd
```

## Casos de prueba a validar

Antes de activar VF-2 (transmisión real), validar:
- [ ] Registro F1 ordinario (primer registro - Huella vacía)
- [ ] Registro F1 encadenado (Huella del anterior)
- [ ] Registro R1 rectificativa
- [ ] Registro R4 rectificativa por diferencias
- [ ] Importes negativos en rectificativas

## Notas

- El XSD valida estructura y tipos de datos, pero NO valida la firma electrónica.
- La firma XAdES no se requiere en VERI*FACTU (solo en NO VERI*FACTU).
- El WebService AEAT valida el hash SHA-256 en el servidor.
- `NumeroInstalacion` debe ser el confirmado por AEAT (actualmente PENDIENTE_AEAT).
