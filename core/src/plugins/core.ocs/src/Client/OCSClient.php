<?php
/*
 * Copyright 2007-2015 Abstrium <contact (at) pydio.com>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */
namespace Pydio\OCS\Client;

defined('AJXP_EXEC') or die('Access not allowed');
defined('AJXP_BIN_FOLDER') or die('Bin folder not available');

require_once(AJXP_BIN_FOLDER . '/guzzle/vendor/autoload.php');

use AJXP_Utils;
use Pydio\OCS\Model\RemoteShare;
use Pydio\OCS\Model\ShareInvitation;
use GuzzleHttp\Client as GuzzleClient;


class OCSClient implements IFederated, IServiceDiscovery
{
    /**
     *
     * Sends an invitation to a remote user on a remote server
     *
     * @param ShareInvitation $invitation
     * @return boolean success
     * @throws \Exception
     */
    public function sendInvitation(ShareInvitation $invitation)
    {
        $client = new GuzzleClient([
            'base_url' => $invitation->getTargetHost()
        ]);

        $endpoints = self::findEndpointsForClient($client);

        $response = $client->post($endpoints['share'], [
            'body' => [
                'shareWith' => $invitation->getTargetUser(),
                'token' => $invitation->getLinkHash(),
                'name' => $invitation->getDocumentName(),
                'remoteId' => $invitation->getId(),
                'owner' => $invitation->getOwner(),
                'remote' => AJXP_Utils::detectServerUrl()
            ]
        ]);

        if ($response->getStatusCode() != 200) {
            throw new \Exception($response->getReasonPhrase());
        }

        return true;
    }

    /**
     *
     * Cancels a sent invitation
     *
     * @param ShareInvitation $inviation
     * @return boolean success
     * @throws \Exception
     */
    public function cancelInvitation(ShareInvitation $invitation)
    {
        $client = new GuzzleClient([
            'base_url' => $invitation->getTargetHost()
        ]);

        $endpoints = self::findEndpointsForClient($client);

        $response = $client->post($endpoints['share'] . '/' . $invitation->getId() . '/unshare', [
            'body' => [
                'token' => $invitation->getLinkHash()
            ]
        ]);

        if ($response->getStatusCode() != 200) {
            throw new \Exception($response->getReasonPhrase());
        }

        return true;
    }

    /**
     *
     * Accepts the invitation sent by the original owner on a remote server
     *
     * @param RemoteShare $remoteShare
     * @return boolean success
     * @throws \Exception
     */
    public function acceptInvitation(RemoteShare $remoteShare)
    {
        $client = new GuzzleClient([
            'base_url' => $remoteShare->getOcsServiceUrl()
        ]);

        $response = $client->post($remoteShare->getOcsRemoteId() . '/accept', [
            'body' => [
                'token' => $remoteShare->getOcsToken(),
            ]
        ]);

        if ($response->getStatusCode() != 200) {
            throw new \Exception($response->getReasonPhrase());
        }

        return true;
    }

    /**
     *
     * Declines the invitation sent by the original owner on a remote server
     *
     * @param RemoteShare $remoteShare
     * @return boolean success
     * @throws \Exception
     */
    public function declineInvitation(RemoteShare $remoteShare)
    {
        $client = new GuzzleClient([
            'base_url' => $remoteShare->getOcsServiceUrl()
        ]);

        $response = $client->post($remoteShare->getOcsRemoteId() . '/decline', [
            'body' => [
                'token' => $remoteShare->getOcsToken(),
            ]
        ]);

        if ($response->getStatusCode() != 200) {
            throw new \Exception($response->getReasonPhrase());
        }

        return true;
    }

    /**
     *
     * Retrieves the OCS Provider endpoints for the URL
     *
     */
    public static function findEndpointsForURL($url) {
        $client = new GuzzleClient([
            'base_url' => $url
        ]);

        return self::findEndpointsForClient($client);
    }

    /**
     *
     * Retrieves the OCS Provider endpoints for the Guzzle Client via a GET request
     *
     * @param GuzzleClient $client
     * @return array endpoints location
     * @throws \Exception
     */
    public static function findEndpointsForClient($client)
    {
        // WARNING - This needs to be relative... :/
        $response = $client->get('ocs-provider/');

        if ($response->getStatusCode() != 200) {
            throw new \Exception('Could not get OCS Provider endpoints');
        }

        $contentType = $response->getHeader('Content-Type');
        if (array_search($contentType, ['text/json', 'application/json']) !== false) {
            $response = $response->json();
        } else if (array_search($contentType, ['text/xml', 'application/xml']) !== false) {
            $response = $response->xml();
        }

        // Flattening response coz Owncloud are not respecting the API
        $response = array_merge((array) $response, (array) $response['services']);

        if (!isset($response['FEDERATED_SHARING']['endpoints'])) {
            throw new \Exception('Provider endpoints response not valid');
        }

        return $response['services']['FEDERATED_SHARING']['endpoints'];
    }
}
