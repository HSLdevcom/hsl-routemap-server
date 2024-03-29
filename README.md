# HSL Routemap server

This project is a spin off from HSL Map publisher, most of the logic used in this project was originally made for the Publisher. This project has been drifting away from the Publisher project, so we decided to make this project in to a whole separate repository.

### Dependencies

Install dependencies:

```
yarn
```

Install `pdftk`

### Pre-step: Create Digitransit apikey

Create .env file and place your Digitransit apikey there. If you still don't have your own, generate one on https://portal-dev.digitransit.fi or https://portal.digitransit.fi (dev / prod). Without apikey the map won't work and generation will fail.


### App

Start development server:

```
yarn start:hot
```

Test URL:
http://localhost:5000/?props={"mapOptions":{"zoom":12.774952540009707,"pitch":0,"scale":4.166666666666667,"width":288,"center":[24.670969761337066,60.13977797444001],"height":288,"bearing":0,"meterPerPxRatio":6},"configuration":{"date":"2018-09-01","name":"test1","nearBuses":false,"scaleLength":200,"scaleFontSize":12,"terminusWidth":170,"maxAnchorLength":60,"stationFontSize":12,"terminusFontSize":13,"intermediatePointWidth":50,"clusterSamePointsDistance":1000,"intermediatePointFontSize":9,"pointMinDistanceFromTerminus":100,"clusterDifferentPointsDistance":20}}

### Writing components

- Write CSS styles @ 72 dpi (i.e. 72 pixels will be 25.4 mm)
- Add components to `renderQueue` for async tasks (PDF is generated when `renderQueue` is empty)
- Use SVG files with unique IDs and no style tags (Illustrator exports)

### Server

Server and REST API for printing components to PDF files and managing their metadata in a Postgres database.

#### 1. Postgres (backend)

Start a Postgres Docker container for routemap:

```
docker run -d -p 5432:5432 --name routemap-postgres -e POSTGRES_PASSWORD=postgres postgres
```

#### 2. Jore PostGIS

Start a Jore PostGIS Docker container:

```
docker run -d -p 5532:5432 --name hsl-jore-postgis -v jore-data:/var/lib/postgresql/data -e POSTGRES_PASSWORD=postgres -e AZURE_STORAGE_ACCOUNT= -e AZURE_STORAGE_KEY= -e AZURE_STORAGE_CONTAINER= hsl-jore-postgis
```

Next, download jore-data into the database (not needed is you just use "Karttageneraattori"). You can use [jore-graphql-import](https://github.com/HSLdevcom/jore-graphql-import) for that, but probably the easiest way to get data is to generate and download a data dump if you have access to the servers.

```
ssh <server ip>
docker exec -it <container name> pg_dump -c -U postgres postgres | gzip > joredata.gz
exit

scp <server ip>:joredata.gz .
gunzip < joredata.gz | docker exec -i hsl-jore-postgis psql -U postgres
```

For more information running local JORE PostGIS see [hsl-jore-postgis](https://github.com/HSLdevcom/hsl-jore-postgis).

#### 3. Redis

Start Redis
```
docker run --name redis --rm -p 6379:6379 -d redis
```

For the default configuration, place the following to `.env`:
```
REDIS_CONNECTION_STRING=redis://localhost:6379
```

Note! A password should be used in production! Use `redis://:<password>@localhost:6379` notation with the authentication.

#### 4. Backend and worker 

Replace `PG_JORE_CONNECTION_STRING` value with your JORE PostGIS instance.

Start backend server:
```
PG_CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres PG_JORE_CONNECTION_STRING=postgres://postgres:postgres@localhost:5532/postgres yarn server
```

Start generator worker (you can start multiple workers if you want)
```
PG_CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/postgres yarn worker
```

#### 5. Start UI and generate "Poikkileikkaus"

See [hsl-map-generator-ui](https://github.com/HSLdevcom/hsl-map-generator-ui) for UI.

As soon as it is started, run the "Päivitä" function of the linjakarttageneraattori poikkileikkauspäivä to generate an actual poikkileikkauspäivä. If the update function is disabled try running the sql script mentioned below.

### Running in Docker

Follow the steps 1.-3. as previous.

IMPORTANT:

Manually create and add a default row to the `routepath_import_config` table.

```
docker exec -it routemap-postgres psql postgres postgres
```

Inside container psql-shell:

```
CREATE TYPE status AS ENUM ('READY', 'PENDING', 'ERROR', 'EMPTY');

create table public.routepath_import_config(
name varchar primary key,
target_date date not null,
status status,
created_at date not null DEFAULT Now(),
updated_at date not null DEFAULT Now());

INSERT INTO "public"."routepath_import_config" ("name", "target_date", "status", "created_at", "updated_at") VALUES ('default', '2019-07-02', 'READY', DEFAULT, DEFAULT);
```

Exit psql and container:

`\q`

Build and start the container:

```
docker build -t hsl-routemap-server .
docker run -d -p 4000:4000 -v $(pwd)/output:/output -v $(pwd)/fonts:/fonts --link routemap-postgres -e "PG_CONNECTION_STRING=postgres://postgres:postgres@routemap-postgres:5432/postgres" -e "PG_JORE_CONNECTION_STRING=placeholder" --shm-size=1G hsl-routemap-server
```

As soon as it is started, run the "Päivitä" function of the linjakarttageneraattori poikkileikkauspäivä to generate an actual poikkileikkauspäivä.

where `fonts` is a directory containing `Gotham Rounded` and `Gotham XNarrow` OpenType fonts.
