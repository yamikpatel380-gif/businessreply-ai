# BusinessReply AI — ગુજરાતી સૂચના

આ કોઈ એક brand માટે નથી; કોઈ પણ દુકાન કે business માટે અલગ AI Support Agent છે.

**તમારે ફક્ત `business.txt`માં પોતાની Businessની સાચી માહિતી લખવાની છે.**

1. `BUSINESS_NAME=` પછી નામ લખો.
2. Products, price, website, business hours અને support contact સાચાં લખો.
3. ચકાસીને `ACTIVE=NO` ને `ACTIVE=YES` કરો.
4. `.env.example`ને `.env` નામ આપી Gemini/OpenAI/Ollama પૈકી એક configure કરો.
5. `START_WINDOWS.bat` ખોલો, local dashboardમાં AI Test કરો.
6. WhatsApp QR અને Gmail OAuth અલગથી connect કરો. Auto Reply ફક્ત ચકાસ્યા પછી ON કરો.

**કોઈ પણ secret `.env` અથવા `credentials.json` GitHub પર અપલોડ ન કરશો.**
WhatsApp QR જોડાણ unofficial છે. મુખ્ય WhatsApp account માટે જોખમ છે. Official Business API વધુ યોગ્ય છે.

આ Source Project છે: local logic tests સફળ થાય એટલે live WhatsApp/Gmail delivery દરેક PCમાં થશે એની ખાતરી નથી.

**નવા વાપરનાર માટે:** આખાં Setup Steps `HOW_TO_RUN.txt` માં છે. `business.txt`ને Project Folderની અંદર જ રાખો. તેમાં Businessની માહિતી **અને** FAQના પ્રશ્નો-જવાબ બંને લખો.

## નવી Premium Dashboard UI

`START_WINDOWS.bat` ચલાવ્યા પછી Local Dashboardમાં 6 વિભાગ છે: Overview, Channels, AI Playground, Business Profile, Activity અને Settings & Help. `Business Profile`માં `business.txt` સીધું Edit અને Save કરી શકો છો. Save કર્યા પછી WhatsApp અને Gmail Auto Reply ફરીથી OFF થઈ જશે; Review કર્યા પછી જ ON કરશો. આ Dashboard Live Backend સાથે જોડાય છે; અનધિકૃત sample data નથી.
