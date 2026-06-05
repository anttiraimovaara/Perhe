#!/bin/bash
# Julkaisee muutokset GitHubiin -> Netlify rakentaa uuden version automaattisesti.
# Käyttö Terminaalissa kansion sisällä:  bash julkaise.sh

cd "$(dirname "$0")" || exit 1

# Siivoa mahdolliset jääneet lukkotiedostot (ei haittaa jos niitä ei ole)
rm -f .git/*.lock .git/objects/*.lock 2>/dev/null

# Kysy lyhyt kuvaus muutoksesta
read -r -p "Kuvaa muutos lyhyesti (Enter = 'Päivitys'): " msg
[ -z "$msg" ] && msg="Päivitys"

git add -A
git commit -m "$msg"   # ei haittaa vaikka ei olisi uutta committoitavaa
git push

echo ""
echo "Valmis. Netlify rakentaa uuden version parissa minuutissa."
