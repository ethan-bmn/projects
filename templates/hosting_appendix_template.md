# ANNEXE TECHNIQUE D'HÉBERGEMENT

**Référence :** {{annexe.reference}}  
**Contrat associé :** {{contrat.reference}}  
**Date :** {{annexe.date}}  
**Version :** {{annexe.version}}

La présente annexe fait partie intégrante du contrat de prestation de réalisation et d'hébergement de sites et applications web conclu entre le Prestataire et le Client.

Elle définit les caractéristiques techniques, les conditions d'exploitation et les engagements de service applicables aux prestations expressément souscrites par le Client.

Les dispositions de cette annexe s'appliquent dans les limites du périmètre défini au devis accepté.

---

## Article 1 - Identification du service

### 1.1 Service hébergé

Les caractéristiques du service sont les suivantes :

- **Nom du service :** {{service.nom}}
  - **Adresse du service :** {{service.url}}
  - **Date de mise en service :** {{service.date_debut}}
  - **Environnement hébergé :** {{service.environnement}}
  - **Périodicité de facturation :** {{hebergement.periodicite}}

### 1.2 Infrastructure d'hébergement

Le service est hébergé sur une infrastructure administrée par le Prestataire, pouvant être fournie par un prestataire d'infrastructure tiers.

Les caractéristiques de l'infrastructure sont les suivantes :

- **Fournisseur :** {{hebergement.fournisseur}}
  - **Type d'hébergement :** {{hebergement.type}}
  - **Localisation géographique :** {{hebergement.localisation}}
  - **Ressources allouées :** {{hebergement.ressources}}
  - **Environnement technique :** {{hebergement.environnement_technique}}

Le Prestataire assure l'administration technique des éléments d'infrastructure relevant de son périmètre contractuel.

Les ressources matérielles peuvent être mutualisées entre plusieurs services, sous réserve du maintien des mesures d'isolation et de sécurité adaptées.

## Article 2 - Disponibilité du service

### 2.1 Principe de disponibilité

Le Prestataire met en œuvre les moyens raisonnablement nécessaires pour maintenir l'accessibilité et le bon fonctionnement du service hébergé.

Le Client reconnaît que l'exploitation d'un service informatique peut nécessiter des interruptions temporaires, notamment pour des opérations de maintenance, des mises à jour ou la résolution d'incidents techniques.

[OPTION : SLA CHIFFRÉ]

### 2.2 Engagement de disponibilité

Le Prestataire s'engage à respecter un taux de disponibilité mensuel de {{sla.taux}} %.

Ce taux est calculé selon la formule suivante :

**Disponibilité (%) = (Durée totale éligible - Durée d'indisponibilité comptabilisée) / Durée totale éligible × 100**

La disponibilité est mesurée sur les bases suivantes :

- **Période de référence :** mois civil
  - **Fuseau horaire :** Europe/Paris
  - **Méthode de supervision :** {{sla.methode}}
  - **Fréquence des contrôles :** {{sla.frequence}}
  - **Critère d'indisponibilité :** {{sla.critere}}

Les interruptions exclues du calcul sont définies à l'article 2.4.

En cas de non-respect du taux contractuellement garanti, les mesures suivantes s'appliquent :

{{sla.compensation}}

[/OPTION]

### 2.3 Absence de disponibilité garantie

[OPTION : SANS SLA]

En l'absence d'un engagement chiffré expressément souscrit, le Prestataire ne garantit pas une disponibilité continue ou ininterrompue du service.

Il s'engage néanmoins à mettre en œuvre les moyens raisonnables relevant de son périmètre pour maintenir le service en fonctionnement et intervenir sur les incidents portés à sa connaissance.

[/OPTION]

### 2.4 Interruptions et événements particuliers

Le service peut être affecté par :

- Les opérations de maintenance programmées ;
  - Les interventions techniques urgentes ;
  - Les incidents matériels ou logiciels ;
  - Les défaillances de connectivité réseau ;
  - Les incidents affectant les prestataires d'infrastructure ;
  - Les événements constitutifs de force majeure ;
  - Les interventions ou modifications réalisées par le Client.

Lorsque le contrat prévoit un SLA chiffré, seules les interruptions expressément identifiées comme exclues dans les conditions du SLA sont écartées de son calcul, dans les limites autorisées par la loi.

Les interruptions et événements précités n'exonèrent pas automatiquement le Prestataire de ses obligations contractuelles ou légales.

## Article 3 - Maintenance de l'infrastructure

### 3.1 Maintenance de l'environnement d'hébergement

Dans le cadre de l'hébergement, le Prestataire assure les opérations techniques nécessaires à l'administration de l'infrastructure relevant de son périmètre.

Ces opérations peuvent notamment comprendre :

- La maintenance du système d'exploitation ;
  - La mise à jour des composants d'infrastructure ;
  - La configuration des services réseau ;
  - La gestion des certificats de chiffrement TLS ;
  - La correction des vulnérabilités identifiées ;
  - Les interventions destinées à préserver la stabilité et la sécurité de l'environnement.

Ces opérations ne constituent pas une prestation de maintenance évolutive de l'application hébergée.

### 3.2 Maintenance programmée

Les opérations de maintenance susceptibles d'entraîner une interruption du service sont, dans la mesure du possible, communiquées préalablement au Client.

- **Fenêtre habituelle de maintenance :** {{maintenance.fenetre}}
  - **Délai indicatif de notification :** {{maintenance.preavis}}

Les opérations présentant un caractère urgent, notamment en raison d'une vulnérabilité critique ou d'un incident de sécurité, peuvent être réalisées sans préavis lorsque les circonstances l'exigent.

[OPTION : MAINTENANCE]

### 3.3 Maintenance applicative

Lorsque le Client souscrit une prestation de maintenance applicative, le Prestataire assure les interventions prévues au devis et au contrat principal.

Le périmètre comprend :

{{maintenance.perimetre}}

Sauf disposition contraire, les modifications fonctionnelles, les nouvelles fonctionnalités et les évolutions graphiques ne sont pas comprises dans cette prestation.

[/OPTION]

## Article 4 - Sécurité de l'hébergement

### 4.1 Mesures de sécurité

Le Prestataire met en œuvre des mesures techniques et organisationnelles proportionnées aux risques associés aux services hébergés.

Les mesures effectivement déployées sont les suivantes :

{{securite.mesures}}

Elles peuvent notamment concerner :

- La limitation et le contrôle des accès administratifs ;
  - La protection des communications ;
  - Le filtrage des connexions réseau ;
  - L'isolation des applications et environnements ;
  - La sécurisation des composants logiciels ;
  - La surveillance des événements techniques ;
  - La gestion des correctifs de sécurité.

Les mesures non expressément prévues ou non mises en œuvre ne sont pas considérées comme des engagements contractuels supplémentaires.

### 4.2 Gestion des vulnérabilités

En cas de découverte d'une vulnérabilité affectant l'infrastructure administrée, le Prestataire évalue les risques associés et met en œuvre les mesures correctives ou compensatoires adaptées.

La priorité des interventions est déterminée notamment par la gravité de la vulnérabilité, son niveau d'exposition et la disponibilité des correctifs.

### 4.3 Gestion des incidents de sécurité

En cas d'incident de sécurité significatif affectant le service hébergé, le Prestataire prend les mesures raisonnablement nécessaires afin d'en limiter les conséquences.

Lorsque l'incident est susceptible d'affecter la disponibilité, l'intégrité ou la confidentialité des données du Client, celui-ci est informé conformément aux dispositions contractuelles et légales applicables.

[OPTION : SOUS_TRAITANCE_RGPD]

Les incidents constituant une violation de données personnelles sont également traités conformément aux dispositions de l'accord de sous-traitance des données personnelles conclu entre les parties.

[/OPTION]

## Article 5 - Sauvegardes automatiques tournantes

[OPTION : SAUVEGARDES]

### 5.1 Principe

Le Prestataire assure la réalisation de sauvegardes automatiques des éléments expressément couverts par la prestation.

Ces sauvegardes fonctionnent selon une politique de conservation tournante, permettant de conserver plusieurs versions successives des données, puis de supprimer automatiquement les versions expirées.

Les sauvegardes ne constituent pas un système d'archivage permanent.

### 5.2 Données sauvegardées

Le périmètre des sauvegardes comprend :

{{sauvegardes.perimetre}}

Les éléments suivants sont exclus :

{{sauvegardes.exclusions}}

### 5.3 Fréquence et politique de rétention

Les sauvegardes sont exécutées selon les paramètres suivants :

- **Fréquence :** {{sauvegardes.frequence}}
  - **Type de sauvegarde :** {{sauvegardes.type}}
  - **Politique de rotation :** {{sauvegardes.rotation}}
  - **Durée maximale de rétention :** {{sauvegardes.retention}}
  - **Emplacement de stockage :** {{sauvegardes.localisation}}
  - **Protection des sauvegardes :** {{sauvegardes.protection}}

Les sauvegardes arrivées à expiration sont automatiquement supprimées conformément à la politique de rétention applicable.

### 5.4 Contrôle des sauvegardes

Le Prestataire met en œuvre les mécanismes de contrôle suivants :

{{sauvegardes.controles}}

Les éventuels tests de restauration sont réalisés selon les modalités suivantes :

{{sauvegardes.tests}}

Lorsqu'un échec de sauvegarde est détecté, le Prestataire engage les mesures correctives raisonnablement nécessaires.

### 5.5 Restauration des données

En cas de perte, de corruption ou de suppression accidentelle de données, le Client peut demander leur restauration à partir d'une sauvegarde disponible et exploitable.

La restauration est réalisée à partir d'un point de sauvegarde existant.

Elle peut entraîner la perte des modifications effectuées entre la date de cette sauvegarde et la date de l'incident.

Les demandes de restauration sont transmises à :

{{support.contact}}

Les modalités de prise en charge sont les suivantes :

{{sauvegardes.modalites_restauration}}

[OPTION : RPO_RTO]

### 5.6 Objectifs de reprise

Les objectifs de reprise convenus sont :

- **RPO (Recovery Point Objective) :** {{sauvegardes.rpo}}
  - **RTO (Recovery Time Objective) :** {{sauvegardes.rto}}

Le RPO désigne la perte maximale de données admise en termes de durée.

Le RTO désigne le délai cible de rétablissement du service après un incident.

La portée contractuelle de ces objectifs, leurs conditions de mesure, leurs exclusions et les conséquences de leur non-respect sont les suivantes :

{{sauvegardes.engagements_reprise}}

[/OPTION]

[OPTION : SANS RPO_RTO]

Aucun objectif chiffré de perte maximale de données ou de délai maximal de restauration n'est contractuellement garanti.

Le Prestataire met néanmoins en œuvre les moyens raisonnables nécessaires à la restauration des données couvertes par la prestation.

[/OPTION]

### 5.7 Limites des sauvegardes

Les sauvegardes visent à réduire les conséquences d'un incident technique ou d'une perte de données.

Elles ne garantissent pas la récupération intégrale des informations en toutes circonstances.

Le Prestataire demeure responsable de la bonne exécution des obligations de sauvegarde expressément souscrites, dans les conditions prévues au contrat principal et par la législation applicable.

[/OPTION]

## Article 6 - Supervision et assistance

[OPTION : SUPERVISION]

### 6.1 Supervision technique

Le Prestataire met en œuvre une supervision des composants suivants :

{{supervision.perimetre}}

Cette supervision peut notamment porter sur la disponibilité du service, la consommation des ressources, les erreurs système et l'état des composants techniques.

Les paramètres de supervision sont :

- **Outil ou méthode :** {{supervision.methode}}
  - **Fréquence des contrôles :** {{supervision.frequence}}
  - **Système d'alerte :** {{supervision.alertes}}

La supervision ne constitue pas une garantie de détection immédiate de tous les incidents.

[/OPTION]

[OPTION : SUPPORT]

### 6.2 Assistance technique

Le Client peut contacter le Prestataire pour signaler un incident ou demander une intervention relevant des prestations souscrites.

- **Contact :** {{support.contact}}
  - **Canal de communication :** {{support.canal}}
  - **Horaires de prise en charge :** {{support.horaires}}
  - **Fuseau horaire :** Europe/Paris

[OPTION : SUPPORT_PRIORITAIRE]

Les incidents sont classés selon leur criticité :

- **Critique :** indisponibilité totale ou incident majeur de sécurité ;
  - **Majeur :** dégradation importante du service ;
  - **Mineur :** dysfonctionnement n'empêchant pas l'utilisation générale du service.

Les délais cibles de prise en charge sont :

{{support.delais}}

Ces délais correspondent à la prise en charge de la demande et non nécessairement à sa résolution, sauf engagement expressément convenu.

[/OPTION]

[/OPTION]

## Article 7 - Limites du périmètre technique

Le Prestataire assure exclusivement les opérations relevant des prestations souscrites et de son périmètre d'administration.

Sauf disposition contraire, les prestations d'hébergement ne comprennent pas :

- La création de nouvelles fonctionnalités ;
  - La modification du contenu éditorial du site ;
  - Les interventions sur les équipements ou réseaux du Client ;
  - L'administration des services tiers non confiés au Prestataire ;
  - La correction des modifications réalisées par des tiers en dehors du périmètre de maintenance convenu ;
  - Les opérations de migration vers une infrastructure externe, sauf accord spécifique.

Ces exclusions ne dispensent pas le Prestataire des obligations légales ou contractuelles qui lui sont applicables.

## Article 8 - Évolution de l'infrastructure

Le Prestataire peut procéder aux adaptations techniques nécessaires au maintien du fonctionnement, de la sécurité et de la pérennité de l'infrastructure.

Ces adaptations peuvent notamment comprendre le remplacement de composants logiciels, la modification de configurations techniques ou la migration des services entre infrastructures compatibles.

Toute modification substantielle ayant un impact sur les caractéristiques essentielles du service, les garanties convenues ou la localisation contractuelle des données fait l'objet d'une information préalable du Client et, lorsque nécessaire, d'un accord ou avenant.

[OPTION : SOUS_TRAITANCE_RGPD]

Les modifications concernant les sous-traitants ultérieurs ou les transferts de données personnelles sont également soumises aux conditions prévues dans l'accord de sous-traitance applicable.

[/OPTION]

## Article 9 - Fin de l'hébergement et restitution des données

À la cessation des prestations d'hébergement, les conditions de résiliation, de restitution et de suppression des données sont celles prévues à l'article 10 du contrat principal.

Le Client dispose notamment d'un délai de trente (30) jours calendaires après la cessation du service pour demander la restitution de ses données.

Le Prestataire met celles-ci à disposition dans un délai maximal de quatorze (14) jours calendaires suivant la réception de la demande.

La restitution est effectuée au moyen d'une archive contenant les fichiers et les exports de bases de données compris dans le périmètre contractuel, transmise par un lien de téléchargement sécurisé.

La prestation de restitution ne comprend pas la migration, l'installation ou la configuration de la solution sur une infrastructure tierce, sauf accord distinct.

Les données et sauvegardes sont supprimées selon les conditions prévues au contrat principal et les durées de conservation applicables.

## Article 10 - Acceptation de l'annexe

La présente annexe complète le contrat principal et s'applique aux services techniques expressément souscrits par le Client.

Les dispositions du contrat principal demeurent applicables pour les questions non traitées par la présente annexe.

**Fait à :** {{contrat.lieu_signature}}  
**Le :** {{contrat.date_signature}}

**Le Prestataire**

{{prestataire.nom}}

Signature :

**Le Client**

{{client.signataire}}

Signature :
