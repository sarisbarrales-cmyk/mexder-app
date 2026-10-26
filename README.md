# MEXDER Derivados Lab

Plataforma web de análisis y operación de derivados MEXDER (futuros y opciones) sobre acciones individuales de la BMV. Lista para desplegar en Vercel.

## Qué incluye

| Módulo | Contenido |
|---|---|
| 01 Data histórica | OHLC y volumen; ciclos diario, semanal, mensual o cada N días; filtro de fechas; carga y descarga de CSV |
| 02 Análisis y valuación | Precio spot, ROC, Williams %R, estocástico %K/%D, RSI 9/14/25, retrocesos y extensiones de Fibonacci, lectura de señales con puntaje |
| 03 Análisis financiero | Resumen, cuenta de resultados, balance, flujos de efectivo, ratios, dividendos, reportes trimestrales y previsión (analistas, proyección propia y cono de precio) |
| 04 Patrones y riesgos | Tendencias primaria y secundaria, beta general y beta por selección de tiempo contra el IPC (^MXX) en cada ciclo, beta móvil, VaR, CVaR, drawdown, Sharpe |
| 05 Análisis gráfico | Pivotes, soportes y resistencias, doble techo o piso, HCH e invertido, triángulos, canales, rupturas y cruces de medias, cada uno con postura sugerida |
| 06 Futuros | Precio teórico F = S·e^((r−q)T), AIM por VaR (o manual), postura sugerida o manual, plazo (mes, bimestre, trimestre, semestre, año, series MEXDER o días), tipo americano/europeo, simulación de liquidación diaria y llamadas de margen |
| 07 Opciones | Black-Scholes-Merton con calibración automática (histórica, EWMA, Parkinson, implícita y sonrisa), griegas, binomial CRR con árbol y convergencia, contrato básico de una postura |
| 08 Coberturas | Straddle y strangle largos y cortos, mariposa con calls y con puts, cap, floor, collar, compra y venta de futuros con stop loss |
| 09–10 Operación | Bitácoras de futuros y opciones con valuación a mercado (se guardan en el navegador) |
| 11 Comparativas | Todas las estrategias simuladas con 4,000 trayectorias y sugerencia por perfil |
| 12 Escenarios | Seis escenarios prospectivos editables para cada perfil (conservador, moderado y agresivo) |
| 13 Reportes | Libro de Excel (.xlsx) con 16 hojas, informe PDF con gráficas e impresión |

## Datos

- `api/history.js`: precios históricos diarios y dividendos (Yahoo Finance, vía `yahoo-finance2`).
- `api/fundamentals.js`: resumen, estados financieros anuales y trimestrales, estimaciones.
- Si la API no responde (por ejemplo al abrir `index.html` sin servidor), la app entra en **modo demostración** con precios simulados y estados financieros ilustrativos, marcados en pantalla.
- También se puede subir un CSV de precios (formato Yahoo Finance o Investing).

Las claves de pizarra usan el sufijo `.MX` (por ejemplo `WALMEX.MX`, `AMXB.MX`, `GFNORTEO.MX`). La tasa libre de riesgo viene en 7.00 % por defecto; actualízala con CETES o TIIE vigentes.

## Desplegar en Vercel

**Opción A, desde GitHub**
1. Sube esta carpeta a un repositorio.
2. En vercel.com → *Add New → Project* → importa el repositorio.
3. Framework Preset: **Other**. No hace falta comando de build ni directorio de salida.
4. *Deploy*.

**Opción B, con la CLI**
```bash
npm i -g vercel
cd mexder-app
vercel          # vista previa
vercel --prod   # producción
```

## Probar en local
```bash
npm install
npx vercel dev   # sirve index.html y las funciones /api en http://localhost:3000
```

## Editar el código
El código fuente está en `src/` (estilos, maquetación, modelos y módulos). Después de editar, regenera `index.html`:
```bash
python3 build.py
```

## Notas de los modelos
- Las AIM reales las determina Asigna; aquí se estiman con VaR paramétrico (σ diaria × z × √días de liquidación) o con un porcentaje manual.
- Probabilidades y valores esperados usan simulación lognormal; el supuesto de tendencia es seleccionable (neutral al riesgo, histórica o lectura técnica).
- La herramienta es de análisis y no constituye recomendación de inversión.
