#!/usr/bin/env bash
set -euo pipefail

# Run this from your extension repo root (where manifest.json lives) 

# Use Git:
# bash create_locales.sh 

mkdir -p _locales/{en,tr,es,pt,fr,de,ru,ja,ko,it,pl,id,zh_CN,ar,uk}

cat > _locales/en/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube Language Filter. Language Immersion & Focus"
  },
  "extension_description": {
    "message": "Filter YouTube videos by language for focus, privacy, and language immersion."
  }
}
EOF

cat > _locales/tr/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube Dil Filtresi. Dile Maruz Kalma ve Odak"
  },
  "extension_description": {
    "message": "Odaklanma, gizlilik ve dile maruz kalma için YouTube videolarını dile göre filtreleyin."
  }
}
EOF

cat > _locales/es/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filtro de idioma de YouTube. Inmersión y enfoque"
  },
  "extension_description": {
    "message": "Filtra videos de YouTube por idioma para concentrarte, proteger tu privacidad y favorecer la inmersión lingüística."
  }
}
EOF

cat > _locales/pt/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filtro de idioma do YouTube. Imersão e foco"
  },
  "extension_description": {
    "message": "Filtre vídeos do YouTube por idioma para mais foco, privacidade e imersão no idioma."
  }
}
EOF

cat > _locales/fr/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filtre de langue YouTube. Immersion et concentration"
  },
  "extension_description": {
    "message": "Filtrez les vidéos YouTube par langue pour rester concentré, protéger votre vie privée et favoriser l’immersion linguistique."
  }
}
EOF

cat > _locales/de/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube-Sprachfilter. Sprachimmersion & Fokus"
  },
  "extension_description": {
    "message": "Filtert YouTube-Videos nach Sprache – für mehr Fokus, Datenschutz und Sprachimmersion."
  }
}
EOF

cat > _locales/ru/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Языковой фильтр YouTube. Погружение и фокус"
  },
  "extension_description": {
    "message": "Фильтруйте видео YouTube по языку, чтобы лучше сосредоточиться, сохранить конфиденциальность и погружаться в язык."
  }
}
EOF

cat > _locales/ja/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube 言語フィルター。没入と集中"
  },
  "extension_description": {
    "message": "集中・プライバシー保護・言語学習の没入のために、YouTube 動画を言語別にフィルタリングします。"
  }
}
EOF

cat > _locales/ko/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube 언어 필터. 몰입과 집중"
  },
  "extension_description": {
    "message": "집중, 개인정보 보호, 언어 몰입을 위해 YouTube 동영상을 언어별로 필터링하세요."
  }
}
EOF

cat > _locales/it/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filtro lingua di YouTube. Immersione e concentrazione"
  },
  "extension_description": {
    "message": "Filtra i video di YouTube per lingua per migliorare la concentrazione, la privacy e l’immersione nella lingua."
  }
}
EOF

cat > _locales/pl/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filtr języka YouTube. Zanurzenie i skupienie"
  },
  "extension_description": {
    "message": "Filtruj filmy YouTube według języka, aby zwiększyć skupienie, zadbać o prywatność i wspierać zanurzenie językowe."
  }
}
EOF

cat > _locales/id/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Filter Bahasa YouTube. Imersi & fokus"
  },
  "extension_description": {
    "message": "Filter video YouTube berdasarkan bahasa untuk membantu fokus, menjaga privasi, dan mendukung imersi bahasa."
  }
}
EOF

cat > _locales/zh_CN/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – YouTube 语言过滤器。沉浸与专注"
  },
  "extension_description": {
    "message": "按语言过滤 YouTube 视频，帮助你更专注、保护隐私，并提升语言沉浸体验。"
  }
}
EOF

cat > _locales/ar/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – فلتر لغة يوتيوب. الانغماس والتركيز"
  },
  "extension_description": {
    "message": "صفِّ مقاطع يوتيوب حسب اللغة لزيادة التركيز وحماية الخصوصية ودعم الانغماس اللغوي."
  }
}
EOF

cat > _locales/uk/messages.json <<'EOF'
{
  "extension_name": {
    "message": "YuLaF – Мовний фільтр YouTube. Занурення та фокус"
  },
  "extension_description": {
    "message": "Фільтруйте відео YouTube за мовою, щоб краще зосереджуватися, зберігати приватність і підтримувати мовне занурення."
  }
}
EOF

echo "✅ Done: created 15 locale folders and messages.json files under _locales/"
